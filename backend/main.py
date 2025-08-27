import base64
from typing import List
import uuid
import modal
import os
import boto3

from pydantic import BaseModel
import requests

from prompts import LYRICS_GENERATOR_PROMPT, PROMPT_GENERATOR_PROMPT

app = modal.App("music-generator")

image = (
    modal.Image.debian_slim()
    .apt_install("git")
    .pip_install_from_requirements("requirements.txt")
    .run_commands(["git clone https://github.com/ace-step/ACE-Step.git /tmp/ACE-Step", "cd /tmp/ACE-Step && pip install ."])
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


class GenerateMusicResponse(BaseModel):
    audio_data: str


@app.cls(
    image=image,
    gpu="L40S",
    volumes={"/models": model_volume, "/.cache/huggingface": hf_volume},
    secrets=[music_gen_secrets],
    scaledown_window=15
)
class MusicGenServer:
    @modal.enter()
    def load_model(self):
        from acestep.pipeline_ace_step import ACEStepPipeline
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from diffusers import AutoPipelineForText2Image
        import torch

        # Music Generation Model
        try:
            self.music_model = ACEStepPipeline(
                checkpoint_dir="/models",
                dtype="bfloat16",
                torch_compile=False,
                cpu_offload=False,
                overlapped_decode=False
            )
            print("✓ Music model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load music model: {e}")
            raise

        # Large Language Model
        try:
            model_id = "Qwen/Qwen2-7B-Instruct"
            self.tokenizer = AutoTokenizer.from_pretrained(model_id)

            self.llm_model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype="auto",
                device_map="auto",
                cache_dir="/.cache/huggingface"
            )
            print("✓ LLM model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load LLM model: {e}")
            raise

        # Stable Diffusion Model (thumbnails)
        try:
            self.image_pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sdxl-turbo", 
                torch_dtype=torch.float16, 
                variant="fp16", 
                cache_dir="/.cache/huggingface"
            )
            self.image_pipe.to("cuda")
            print("✓ Image generation model loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load image model: {e}")
            raise

    def prompt_qwen(self, question: str):
        try:
            messages = [
                {"role": "user", "content": question}
            ]
            text = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True
            )
            model_inputs = self.tokenizer(
                [text], return_tensors="pt").to(self.llm_model.device)

            generated_ids = self.llm_model.generate(
                model_inputs.input_ids,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            generated_ids = [
                output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
            ]

            response = self.tokenizer.batch_decode(
                generated_ids, skip_special_tokens=True)[0]

            return response.strip()
        except Exception as e:
            print(f"Error in prompt_qwen: {e}")
            raise

    def generate_prompt(self, description: str):
        try:
            full_prompt = PROMPT_GENERATOR_PROMPT.format(user_prompt=description)
            return self.prompt_qwen(full_prompt)
        except Exception as e:
            print(f"Error generating prompt: {e}")
            return f"electronic, {description}"  # Fallback

    def generate_lyrics(self, description: str):
        try:
            full_prompt = LYRICS_GENERATOR_PROMPT.format(description=description)
            return self.prompt_qwen(full_prompt)
        except Exception as e:
            print(f"Error generating lyrics: {e}")
            return "[verse]\nGenerated music about " + description + "\n[chorus]\nMusic for everyone"  # Fallback

    def generate_categories(self, description: str) -> List[str]:
        try:
            prompt = f"Based on the following music description, list 3-5 relevant genres or categories as a comma-separated list. For example: Pop, Electronic, Sad, 80s. Description: '{description}'"
            response_text = self.prompt_qwen(prompt)
            categories = [cat.strip() for cat in response_text.split(",") if cat.strip()]
            return categories[:5]  # Limit to 5 categories
        except Exception as e:
            print(f"Error generating categories: {e}")
            return ["Electronic", "AI Generated"]  # Fallback

    def generate_and_upload_to_s3(
            self,
            prompt: str,
            lyrics: str,
            instrumental: bool,
            audio_duration: float,
            infer_step: int,
            guidance_scale: float,
            seed: int,
            description_for_categorization: str
    ) -> GenerateMusicResponseS3:
        try:
            final_lyrics = "[instrumental]" if instrumental else lyrics
            print(f"Generated lyrics: \n{final_lyrics}")
            print(f"Prompt: \n{prompt}")

            # S3 setup
            s3_client = boto3.client("s3")
            bucket_name = os.environ.get("S3_BUCKET_NAME")
            
            if not bucket_name:
                raise ValueError("S3_BUCKET_NAME environment variable not set")

            output_dir = "/tmp/outputs"
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, f"{uuid.uuid4()}.wav")

            # Generate music
            self.music_model(
                prompt=prompt,
                lyrics=final_lyrics,
                audio_duration=audio_duration,
                infer_step=infer_step,
                guidance_scale=guidance_scale,
                save_path=output_path,
                manual_seeds=str(seed) if seed != -1 else None
            )

            # Upload audio to S3
            audio_s3_key = f"music/{uuid.uuid4()}.wav"
            s3_client.upload_file(output_path, bucket_name, audio_s3_key)
            os.remove(output_path)

            # Generate and upload thumbnail
            thumbnail_prompt = f"{prompt}, album cover art, music cover, artistic"
            image = self.image_pipe(
                prompt=thumbnail_prompt, 
                num_inference_steps=2, 
                guidance_scale=0.0
            ).images[0]

            image_output_path = os.path.join(output_dir, f"{uuid.uuid4()}.png")
            image.save(image_output_path)

            image_s3_key = f"covers/{uuid.uuid4()}.png"
            s3_client.upload_file(image_output_path, bucket_name, image_s3_key)
            os.remove(image_output_path)

            # Generate categories
            categories = self.generate_categories(description_for_categorization)

            return GenerateMusicResponseS3(
                s3_key=audio_s3_key,
                cover_image_s3_key=image_s3_key,
                categories=categories
            )
        except Exception as e:
            print(f"Error in generate_and_upload_to_s3: {e}")
            raise

    @modal.fastapi_endpoint(method="POST")
    def generate_from_description(self, request: GenerateFromDescriptionRequest) -> GenerateMusicResponseS3:
        try:
            # Generating a prompt
            prompt = self.generate_prompt(request.full_described_song)

            # Generating lyrics
            lyrics = ""
            if not request.instrumental:
                lyrics = self.generate_lyrics(request.full_described_song)
            
            return self.generate_and_upload_to_s3(
                prompt=prompt, 
                lyrics=lyrics,
                description_for_categorization=request.full_described_song, 
                **request.model_dump(exclude={"full_described_song"})
            )
        except Exception as e:
            print(f"Error in generate_from_description: {e}")
            raise modal.exception.InvalidError(f"Generation failed: {str(e)}")

    @modal.fastapi_endpoint(method="POST")
    def generate_with_lyrics(self, request: GenerateWithCustomLyricsRequest) -> GenerateMusicResponseS3:
        try:
            return self.generate_and_upload_to_s3(
                prompt=request.prompt, 
                lyrics=request.lyrics,
                description_for_categorization=request.prompt, 
                **request.model_dump(exclude={"prompt", "lyrics"})
            )
        except Exception as e:
            print(f"Error in generate_with_lyrics: {e}")
            raise modal.exception.InvalidError(f"Generation failed: {str(e)}")

    @modal.fastapi_endpoint(method="POST")
    def generate_with_described_lyrics(self, request: GenerateWithDescribedLyricsRequest) -> GenerateMusicResponseS3:
        try:
            # Generating lyrics
            lyrics = ""
            if not request.instrumental:
                lyrics = self.generate_lyrics(request.described_lyrics)
            
            return self.generate_and_upload_to_s3(
                prompt=request.prompt, 
                lyrics=lyrics,
                description_for_categorization=request.prompt, 
                **request.model_dump(exclude={"described_lyrics", "prompt"})
            )
        except Exception as e:
            print(f"Error in generate_with_described_lyrics: {e}")
            raise modal.exception.InvalidError(f"Generation failed: {str(e)}")


@app.local_entrypoint()
def main():
    try:
        server = MusicGenServer()
        endpoint_url = server.generate_with_described_lyrics.get_web_url()

        request_data = GenerateWithDescribedLyricsRequest(
            prompt="rave, funk, 140BPM, disco",
            described_lyrics="lyrics about water bottles",
            guidance_scale=15
        )

        payload = request_data.model_dump()

        print(f"Making request to: {endpoint_url}")
        print(f"Payload: {payload}")

        response = requests.post(endpoint_url, json=payload, timeout=300)  # 5 minute timeout
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"Error response text: {response.text}")
            response.raise_for_status()

        result = GenerateMusicResponseS3(**response.json())
        print(f"Success: {result.s3_key} {result.cover_image_s3_key} {result.categories}")

    except Exception as e:
        print(f"Error in main: {e}")
        raise
