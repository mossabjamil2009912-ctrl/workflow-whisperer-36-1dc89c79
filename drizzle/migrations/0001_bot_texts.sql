CREATE TABLE public.bot_texts (
  key text PRIMARY KEY,
  msg_key text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  section text NOT NULL DEFAULT 'رسائل أخرى',
  place text,
  sort integer NOT NULL DEFAULT 0,
  original text NOT NULL,
  value text,
  btn_id text,
  btn_desc text,
  desc_value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_texts TO service_role;
ALTER TABLE public.bot_texts ENABLE ROW LEVEL SECURITY;