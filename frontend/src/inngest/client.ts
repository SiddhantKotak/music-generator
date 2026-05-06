import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "music-generator",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
