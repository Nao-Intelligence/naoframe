import { env } from "./env";
import { supabaseAdmin } from "./supabase/admin";

export async function createSignedAudioUrls(
  keys: Array<string | null | undefined>,
  expiresInSec = 3600,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const valid = keys.filter((k): k is string => !!k);
  if (valid.length === 0) return result;

  const supabase = supabaseAdmin();
  for (const key of valid) {
    const { data, error } = await supabase.storage
      .from(env.AUDIO_BUCKET)
      .createSignedUrl(key, expiresInSec);
    if (!error && data?.signedUrl) result.set(key, data.signedUrl);
  }
  return result;
}
