-- GarimpoLeads - Schema inicial (MVP)
-- Rodar direto no SQL Editor do Supabase

create extension if not exists "uuid-ossp";

-- Leads encontrados via Google Maps / diretórios
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null, -- ex: advogado, dentista
  phone text,
  address text,
  website text,
  google_maps_url text,
  source text not null default 'google_maps',
  created_at timestamptz not null default now()
);

-- Resultado da análise do site do lead
create table if not exists site_analysis (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  has_website boolean not null default false,
  is_wordpress boolean,
  performance_score int, -- 0-100, ex: Lighthouse
  is_outdated boolean,
  is_slow boolean,
  notes text,
  analyzed_at timestamptz not null default now()
);

-- Emails encontrados via Hunter.io
create table if not exists outreach (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  email text,
  email_confidence int, -- score do Hunter.io
  status text not null default 'pending', -- pending | contacted | responded | ignored | unsubscribed | bounced
  contacted_at timestamptz,
  follow_up_sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Logs de execução do cron diário
create table if not exists execution_logs (
  id uuid primary key default uuid_generate_v4(),
  ran_at timestamptz not null default now(),
  leads_found int not null default 0,
  emails_found int not null default 0,
  errors text,
  duration_ms int
);

-- Template editável da mensagem de outreach. `category = null` é o template
-- padrão (fallback); pode ter 1 template específico por categoria também.
create table if not exists message_templates (
  id uuid primary key default uuid_generate_v4(),
  category text,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_message_templates_category
  on message_templates ((coalesce(category, '')));

-- Categorias e cidades usadas pelo cron diário (editável pelo dashboard).
-- Sempre 1 linha só; se vazia, o código usa os defaults embutidos.
create table if not exists prospection_config (
  id uuid primary key default uuid_generate_v4(),
  categories text[] not null default '{}',
  cities text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_analysis_lead_id on site_analysis(lead_id);
create index if not exists idx_outreach_lead_id on outreach(lead_id);
create index if not exists idx_outreach_status on outreach(status);
