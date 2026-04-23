import OpenAI from "openai";
import { env } from "./env";

let cached: OpenAI | null = null;
function client() {
  if (!cached) cached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cached;
}

export async function transcribeAudio(
  file: File,
  opts?: { language?: string },
): Promise<string> {
  const result = await client().audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: opts?.language,
    response_format: "text",
  });
  return typeof result === "string" ? result.trim() : String(result).trim();
}
