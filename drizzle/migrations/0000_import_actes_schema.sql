CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text, city text, notes text, system text, last_message text,
  stage text NOT NULL DEFAULT 'new',
  unread integer NOT NULL DEFAULT 0,
  last_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bot_paused boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'customer',
  kind text NOT NULL DEFAULT 'text',
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  file_name text, media_id text, media_url text, mime text
);
CREATE INDEX IF NOT EXISTS messages_customer_created_idx ON public.messages(customer_id, created_at);
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  name text, city text, amount text, details text, invoice_no text, method text,
  status text NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1001;
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE DEFAULT ('ACTES-SUP-' || nextval('public.support_ticket_seq')::text),
  customer_id uuid REFERENCES public.customers(id),
  phone text NOT NULL,
  name text, city text, device text, issue_type text, description text,
  media_id text, media_type text,
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_tickets TO service_role;
GRANT USAGE ON SEQUENCE public.support_ticket_seq TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.catalog_items (
  key text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'item',
  category text NOT NULL DEFAULT 'other',
  category_title text,
  name text NOT NULL,
  unit text,
  price numeric,
  label text,
  pdf_url text,
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  auto_rules jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no text NOT NULL DEFAULT ('ACTES-Q-' || to_char(now(),'YYMMDD-HH24MISS')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  phone text,
  city text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bot_button_locks (
  context_id text PRIMARY KEY,
  choice text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_button_locks TO service_role;
ALTER TABLE public.bot_button_locks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.report_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  phone text NOT NULL,
  name text,
  system_label text,
  kind text NOT NULL DEFAULT 'pvsyst',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  file_path text, file_name text,
  city text, lat double precision, lon double precision, tilt double precision, azimuth text
);
GRANT ALL ON public.report_requests TO service_role;
ALTER TABLE public.report_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.preset_reports (
  preset_title text NOT NULL,
  kind text NOT NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (preset_title, kind)
);
GRANT ALL ON public.preset_reports TO service_role;
ALTER TABLE public.preset_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_settings (key text PRIMARY KEY, value numeric NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;