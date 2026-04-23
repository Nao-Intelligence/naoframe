const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

export const env = {
  SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
  OPENAI_API_KEY: required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  AUDIO_BUCKET: process.env.SUPABASE_AUDIO_BUCKET ?? "feedback-audio",
  WIREFRAME_BUCKET: process.env.SUPABASE_WIREFRAME_BUCKET ?? "wireframes",
};
