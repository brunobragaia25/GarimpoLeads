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
  created_at timestamptz not null default now(),
  crm_synced_at timestamptz, -- quando foi enviado como cliente pro GestãoDevz
  crm_doc_id text -- id do documento no Firestore, pra permitir desfazer
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

-- Rate limit do login do dashboard (protecao contra forca bruta).
create table if not exists login_attempts (
  ip text primary key,
  failed_count int not null default 0,
  locked_until timestamptz
);

-- Conversa de WhatsApp automatizada (template Meta + resposta por IA).
-- Separado da tabela `outreach` porque ela é orientada a email (email,
-- email_confidence, opened_at, clicked_at não fazem sentido pro WhatsApp).
-- `status` controla a janela de atendimento de 24h da Meta: template_sent/
-- open = janela ativa (pode responder com texto livre grátis), closed =
-- passou de 24h sem resposta, precisa de novo template pra reabrir.
create table if not exists whatsapp_conversations (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  phone text not null,
  template_sent_at timestamptz,
  followup_sent_at timestamptz, -- follow-up automatico pra quem nunca respondeu ao template inicial
  last_outbound_at timestamptz,
  last_inbound_at timestamptz,
  last_read_at timestamptz, -- quando o Bruno abriu essa conversa por ultimo, pra badge de "nao lida"
  deleted_at timestamptz, -- exclusao "suave": some da lista/chat, mas mantem o registro pra nunca
  -- reenviar template pro mesmo lead nem perder a contagem de envios do dia
  pinned_at timestamptz, -- conversa fixada no topo da lista, igual WhatsApp
  favorited_at timestamptz, -- conversa favoritada, pra filtrar so as favoritas
  needs_handoff boolean not null default false, -- IA marcou que essa conversa precisa do Bruno
  handoff_reason text, -- motivo curto (reuniao, contrato, reclamacao, etc.)
  status text not null default 'template_sent', -- template_sent | open | closed
  ai_enabled boolean not null default true, -- false depois que o humano manda mensagem manual
  created_at timestamptz not null default now()
);

-- Histórico de mensagens de cada conversa, usado tanto como log quanto
-- como contexto pra Claude API montar a resposta seguinte.
create table if not exists whatsapp_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  direction text not null, -- inbound | outbound
  body text not null,
  wa_message_id text,
  created_at timestamptz not null default now()
);

-- Log de uso da IA (Claude Haiku) nas respostas automaticas do WhatsApp,
-- usado pra estimar custo em USD no painel /usage.
create table if not exists ai_usage_log (
  id uuid primary key default uuid_generate_v4(),
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

-- Expoe o tamanho do banco pro painel /usage (a API de management do
-- Supabase nao expoe isso de forma self-service com token de acesso).
create or replace function get_database_size()
returns bigint
language sql
security definer
as $$
  select pg_database_size(current_database());
$$;

create index if not exists idx_site_analysis_lead_id on site_analysis(lead_id);
create index if not exists idx_outreach_lead_id on outreach(lead_id);
create index if not exists idx_outreach_status on outreach(status);
create index if not exists idx_whatsapp_conversations_lead_id on whatsapp_conversations(lead_id);
create index if not exists idx_whatsapp_conversations_phone on whatsapp_conversations(phone);
create index if not exists idx_whatsapp_messages_conversation_id on whatsapp_messages(conversation_id);

-- RLS ligado em tudo, sem nenhuma policy: bloqueia qualquer acesso via
-- anon key pelo PostgREST público do Supabase. O app só usa a service
-- role (que ignora RLS), então nada muda pro código.
alter table leads enable row level security;
alter table site_analysis enable row level security;
alter table outreach enable row level security;
alter table execution_logs enable row level security;
alter table message_templates enable row level security;
alter table prospection_config enable row level security;
alter table login_attempts enable row level security;
alter table whatsapp_conversations enable row level security;
alter table whatsapp_messages enable row level security;
alter table ai_usage_log enable row level security;
