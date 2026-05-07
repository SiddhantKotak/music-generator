from typing import List
import uuid
import modal
import os

from pydantic import BaseModel

from prompts import LYRICS_GENERATOR_PROMPT, PROMPT_GENERATOR_PROMPT

app = modal.App("music-generator")

image = (
    modal.Image.debian_slim()
    .apt_install("git", "ffmpeg")
    .pip_install_from_requirements("requirements.txt")
    .run_commands([
        "git clone https://github.com/ace-step/ACE-Step.git /tmp/ACE-Step",
        "cd /tmp/ACE-Step && pip install .",
        # ACE-Step's setup.py upgrades diffusers to its own floor (>=0.33.0) and
        # often pulls in 0.36+ where the flux2 pipeline lives. flux2's
        # pipeline_flux2_klein.py has an unconditional
        # `from transformers import Qwen3ForCausalLM`, which doesn't exist in
        # transformers 4.50.0 (which ACE-Step itself pins) and crashes
        # @modal.enter() on container boot.
        # We pin to 0.35.0: the highest pre-flux2 release that still has every
        # symbol ACE-Step imports (AutoencoderDC, ModelMixin,
        # FromOriginalModelMixin, ConfigMixin, register_to_config). --no-deps so
        # we don't disturb transformers/torch.
        "pip install --no-deps --force-reinstall diffusers==0.35.0",
    ])
    .env({"HF_HOME": "/.cache/huggingface"})
    .add_local_python_source("prompts")
)

model_volume = modal.Volume.from_name(
    "ace-step-models", create_if_missing=True)
hf_volume = modal.Volume.from_name("qwen-hf-cache", create_if_missing=True)

music_gen_secrets = modal.Secret.from_name("music-gen-secret")


class AudioGenerationBase(BaseModel):
    audio_duration: float = 180.0
    seed: int = -1
    guidance_scale: float = 15.0
    infer_step: int = 60
    instrumental: bool = False


class GenerateFromDescriptionRequest(AudioGenerationBase):
    full_described_song: str


class GenerateWithCustomLyricsRequest(AudioGenerationBase):
    prompt: str
    lyrics: str


class GenerateWithDescribedLyricsRequest(AudioGenerationBase):
    prompt: str
    described_lyrics: str


class GenerateMusicResponseS3(BaseModel):
    s3_key: str
    cover_image_s3_key: str
    categories: List[str]


@app.cls(
    image=image,
    gpu="L40S",
    volumes={"/models": model_volume, "/.cache/huggingface": hf_volume},
    secrets=[music_gen_secrets],
    scaledown_window=15,
)
class MusicGenServer:
    @modal.enter()
    def load_model(self):
        from acestep.pipeline_ace_step import ACEStepPipeline
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from diffusers import AutoPipelineForText2Image
        import torch

        try:
            self.music_model = ACEStepPipeline(
                checkpoint_dir="/models",
                dtype="bfloat16",
                torch_compile=False,
                cpu_offload=False,
                overlapped_decode=False,
            )
            print("✓ Music model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load music model: {e}")
            raise

        try:
            model_id = "Qwen/Qwen2-7B-Instruct"
            self.tokenizer = AutoTokenizer.from_pretrained(model_id)
            self.llm_model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype="auto",
                device_map="auto",
                cache_dir="/.cache/huggingface",
            )
            print("✓ LLM model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load LLM model: {e}")
            raise

        try:
            self.image_pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sdxl-turbo",
                torch_dtype=torch.float16,
                variant="fp16",
                cache_dir="/.cache/huggingface",
            )
            self.image_pipe.to("cuda")
            print("✓ Image generation model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load image model: {e}")
            raise

    def prompt_qwen(self, question: str):
        messages = [{"role": "user", "content": question}]
        text = self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        model_inputs = self.tokenizer([text], return_tensors="pt").to(
            self.llm_model.device
        )
        generated_ids = self.llm_model.generate(
            model_inputs.input_ids,
            max_new_tokens=512,
            temperature=0.7,
            do_sample=True,
            pad_token_id=self.tokenizer.eos_token_id,
        )
        generated_ids = [
            output_ids[len(input_ids):]
            for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]
        return self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

    def generate_prompt(self, description: str):
        try:
            return self.prompt_qwen(PROMPT_GENERATOR_PROMPT.format(user_prompt=description))
        except Exception as e:
            print(f"Error generating prompt: {e}")
            return f"electronic, {description}"

    def generate_lyrics(self, description: str):
        try:
            return self.prompt_qwen(LYRICS_GENERATOR_PROMPT.format(description=description))
        except Exception as e:
            print(f"Error generating lyrics: {e}")
            return f"[verse]\nGenerated music about {description}\n[chorus]\nMusic for everyone"

    def generate_categories(self, description: str) -> List[str]:
        try:
            prompt = (
                f"Based on the following music description, list 3-5 relevant genres or categories "
                f"as a comma-separated list. For example: Pop, Electronic, Sad, 80s. "
                f"Description: '{description}'"
            )
            response_text = self.prompt_qwen(prompt)
            categories = [c.strip() for c in response_text.split(",") if c.strip()]
            return categories[:5]
        except Exception as e:
            print(f"Error generating categories: {e}")
            return ["Electronic", "AI Generated"]

    def generate_and_upload_to_r2(
        self,
        prompt: str,
        lyrics: str,
        instrumental: bool,
        audio_duration: float,
        infer_step: int,
        guidance_scale: float,
        seed: int,
        description_for_categorization: str,
    ) -> GenerateMusicResponseS3:
        import boto3

        final_lyrics = "[instrumental]" if instrumental else lyrics
        print(f"Generated lyrics: \n{final_lyrics}")
        print(f"Prompt: \n{prompt}")

        r2_endpoint = os.environ.get("R2_ENDPOINT")
        if not r2_endpoint:
            raise ValueError("R2_ENDPOINT environment variable not set")
        s3_client = boto3.client(
            "s3",
            endpoint_url=r2_endpoint,
            region_name=os.environ.get("AWS_REGION", "auto"),
        )
        bucket_name = os.environ.get("S3_BUCKET_NAME")
        if not bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable not set")

        output_dir = "/tmp/outputs"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.wav")

        self.music_model(
            prompt=prompt,
            lyrics=final_lyrics,
            audio_duration=audio_duration,
            infer_step=infer_step,
            guidance_scale=guidance_scale,
            save_path=output_path,
            manual_seeds=str(seed) if seed != -1 else None,
        )

        audio_s3_key = f"music/{uuid.uuid4()}.wav"
        s3_client.upload_file(output_path, bucket_name, audio_s3_key)
        os.remove(output_path)

        thumbnail_prompt = f"{prompt}, album cover art, music cover, artistic"
        image = self.image_pipe(
            prompt=thumbnail_prompt, num_inference_steps=2, guidance_scale=0.0
        ).images[0]

        image_output_path = os.path.join(output_dir, f"{uuid.uuid4()}.png")
        image.save(image_output_path)
        image_s3_key = f"covers/{uuid.uuid4()}.png"
        s3_client.upload_file(image_output_path, bucket_name, image_s3_key)
        os.remove(image_output_path)

        categories = self.generate_categories(description_for_categorization)

        return GenerateMusicResponseS3(
            s3_key=audio_s3_key,
            cover_image_s3_key=image_s3_key,
            categories=categories,
        )

    # ---- Long-running jobs spawned by the spawn endpoints ----

    @modal.method()
    def generate_from_description_job(self, request_data: dict) -> dict:
        request = GenerateFromDescriptionRequest(**request_data)
        prompt = self.generate_prompt(request.full_described_song)
        lyrics = ""
        if not request.instrumental:
            lyrics = self.generate_lyrics(request.full_described_song)
        result = self.generate_and_upload_to_r2(
            prompt=prompt,
            lyrics=lyrics,
            description_for_categorization=request.full_described_song,
            **request.model_dump(exclude={"full_described_song"}),
        )
        return result.model_dump()

    @modal.method()
    def generate_with_lyrics_job(self, request_data: dict) -> dict:
        request = GenerateWithCustomLyricsRequest(**request_data)
        result = self.generate_and_upload_to_r2(
            prompt=request.prompt,
            lyrics=request.lyrics,
            description_for_categorization=request.prompt,
            **request.model_dump(exclude={"prompt", "lyrics"}),
        )
        return result.model_dump()

    @modal.method()
    def generate_with_described_lyrics_job(self, request_data: dict) -> dict:
        request = GenerateWithDescribedLyricsRequest(**request_data)
        lyrics = ""
        if not request.instrumental:
            lyrics = self.generate_lyrics(request.described_lyrics)
        result = self.generate_and_upload_to_r2(
            prompt=request.prompt,
            lyrics=lyrics,
            description_for_categorization=request.prompt,
            **request.model_dump(exclude={"described_lyrics", "prompt"}),
        )
        return result.model_dump()

# ---- Public spawn endpoints (lightweight CPU functions) ----
#
# These are top-level @app.function endpoints, NOT class methods. That's
# critical: a request to a class method has to wait for @modal.enter() to
# finish loading ~20 GB of models before it can run, which blows past
# Vercel's 60s function-invocation timeout on the very first cold start.
# Top-level functions don't have that constraint — they return the
# spawned-job's call_id in <1s and the heavy GPU container boots in the
# background.


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def generate_from_description(request: GenerateFromDescriptionRequest):
    fc = MusicGenServer().generate_from_description_job.spawn(request.model_dump())
    return {"call_id": fc.object_id}


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def generate_with_lyrics(request: GenerateWithCustomLyricsRequest):
    fc = MusicGenServer().generate_with_lyrics_job.spawn(request.model_dump())
    return {"call_id": fc.object_id}


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def generate_with_described_lyrics(request: GenerateWithDescribedLyricsRequest):
    fc = MusicGenServer().generate_with_described_lyrics_job.spawn(request.model_dump())
    return {"call_id": fc.object_id}


# Lightweight CPU-only status endpoint — does not need GPU class.
@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def get_status(call_id: str):
    try:
        fc = modal.FunctionCall.from_id(call_id)
        result = fc.get(timeout=0)
        return {"status": "done", "result": result}
    except TimeoutError:
        return {"status": "running"}
    except modal.exception.OutputExpiredError:
        return {"status": "expired"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


@app.local_entrypoint()
def main():
    import requests

    spawn_url = generate_with_described_lyrics.get_web_url()

    request_data = GenerateWithDescribedLyricsRequest(
        prompt="rave, funk, 140BPM, disco",
        described_lyrics="lyrics about water bottles",
        guidance_scale=15,
    )
    payload = request_data.model_dump()
    print(f"Spawning at: {spawn_url}")
    response = requests.post(spawn_url, json=payload, timeout=30)
    response.raise_for_status()
    spawn = response.json()
    print(f"Spawn response: {spawn}")

    status_url = get_status.get_web_url()
    print(f"Status endpoint: {status_url}?call_id={spawn['call_id']}")
