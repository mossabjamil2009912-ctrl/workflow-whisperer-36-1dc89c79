CREATE TABLE public.bot_steps (
  id text PRIMARY KEY DEFAULT substr(md5(random()::text), 1, 8),
  trigger_key text,
  trigger_id text,
  trigger_title text,
  section text,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'buttons',
  list_button text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_steps TO service_role;
ALTER TABLE public.bot_steps ENABLE ROW LEVEL SECURITY;