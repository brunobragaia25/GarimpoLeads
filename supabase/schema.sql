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
  status text not null default 'pending', -- pending | contacted | responded | ignored
  contacted_at timestamptz,
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

create index if not exists idx_site_analysis_lead_id on site_analysis(lead_id);
create index if not exists idx_outreach_lead_id on outreach(lead_id);
create index if not exists idx_outreach_status on outreach(status);
