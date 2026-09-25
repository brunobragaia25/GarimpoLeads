-- Visao "achatada" de cada lead (lead + ultima analise do site + outreach +
-- conversa de WhatsApp + campos calculados), pro dashboard e as filas
-- filtrarem/ordenarem/paginarem/contarem direto no banco em vez de baixar
-- todos os leads a cada acesso. Idempotente: pode rodar de novo sem erro.
--
-- security_invoker: a view roda com a permissao de quem consulta, entao o
-- RLS das tabelas continua valendo (anon nao le nada; o app usa service
-- role). Sem isso a view vazaria os dados pela API publica.

-- ---------------------------------------------------------------------
-- Colunas novas usadas pela view abaixo (todas idempotentes)
-- ---------------------------------------------------------------------

-- Registro do que cada disparo do cron realmente fez, por pais.
alter table execution_logs add column if not exists emails_sent int not null default 0;
alter table execution_logs add column if not exists follow_ups_sent int not null default 0;
alter table execution_logs add column if not exists emails_failed int not null default 0;
alter table execution_logs add column if not exists blocked_by_check int not null default 0;
alter table execution_logs add column if not exists by_country jsonb;

-- Achados reais do PageSpeed Insights (Lighthouse do Google, no celular).
alter table site_analysis add column if not exists ps_mobile_score int;
alter table site_analysis add column if not exists ps_lcp_ms int;
alter table site_analysis add column if not exists ps_analyzed_at timestamptz;

-- Resposta detectada na caixa de entrada.
alter table outreach add column if not exists replied_at timestamptz;
alter table outreach add column if not exists reply_snippet text;

create or replace view lead_overview with (security_invoker = true) as
select
  l.id,
  l.name,
  l.category,
  l.phone,
  l.address,
  l.website,
  l.google_maps_url,
  l.country,
  l.created_at,
  l.crm_synced_at,
  sa.has_website,
  sa.is_wordpress,
  sa.performance_score,
  sa.is_outdated,
  sa.is_slow,
  sa.is_broken,
  sa.broken_reason,
  sa.notes as site_notes,
  o.email,
  o.email_confidence,
  o.status as outreach_status,
  o.contacted_at,
  o.follow_up_sent_at,
  o.opened_at,
  o.clicked_at,
  wc.template_sent_at as whatsapp_template_sent_at,
  wc.followup_sent_at as whatsapp_followup_sent_at,
  sp.social_platform,
  (l.website is not null) as has_site,
  -- Portugal tem 9 digitos; os demais paises, 10+ (espelha minPhoneDigits
  -- em src/lib/countries.ts).
  (length(p.digits) >= case when l.country = 'PT' then 9 else 10 end) as has_usable_phone,
  (length(p.local) = 11 and substr(p.local, 3, 1) = '9') as is_mobile,
  (
    sa.has_website is false
    or sp.social_platform is not null
    or coalesce(sa.is_broken, false)
    or coalesce(sa.is_wordpress, false)
    or coalesce(sa.is_slow, false)
    or coalesce(sa.is_outdated, false)
  ) as is_priority,
  round(
    (case when sa.has_website is false then 100 else 0 end)
    + (case when sa.is_broken then 90 else 0 end)
    + (case when sp.social_platform is not null then 80 else 0 end)
    + (case when sa.is_wordpress then 30 else 0 end)
    + (case when sa.is_slow then 30 else 0 end)
    + (case when sa.is_outdated then 20 else 0 end)
    + (case when sa.performance_score is not null
         then greatest(0, 100 - sa.performance_score) * 0.2 else 0 end)
  )::int as score,
  (o.contacted_at at time zone 'America/Sao_Paulo')::date as contacted_date,
  (o.follow_up_sent_at at time zone 'America/Sao_Paulo')::date as follow_up_date,
  sa.ps_mobile_score,
  sa.ps_lcp_ms,
  o.replied_at,
  o.reply_snippet
from leads l
left join lateral (
  select has_website, is_wordpress, performance_score, is_outdated, is_slow,
         is_broken, broken_reason, notes, ps_mobile_score, ps_lcp_ms
  from site_analysis where lead_id = l.id
  order by analyzed_at desc limit 1
) sa on true
left join lateral (
  select email, email_confidence, status, contacted_at, follow_up_sent_at,
         opened_at, clicked_at, replied_at, reply_snippet
  from outreach where lead_id = l.id
  order by created_at desc limit 1
) o on true
left join lateral (
  select template_sent_at, followup_sent_at
  from whatsapp_conversations where lead_id = l.id
  order by created_at desc limit 1
) wc on true
cross join lateral (
  select regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') as digits
) d
cross join lateral (
  select d.digits,
         case when d.digits like '55%' then substr(d.digits, 3) else d.digits end as local
) p
cross join lateral (
  select lower(regexp_replace(
    substring(
      case when l.website ~ '^http' then l.website else 'https://' || l.website end
      from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#:]+)'
    ),
    '^www\.', ''
  )) as host
) h
cross join lateral (
  select case
    when h.host is null then null
    when h.host = 'instagram.com' or h.host like '%.instagram.com' then 'instagram'
    when h.host in ('facebook.com', 'fb.com', 'fb.me')
      or h.host like '%.facebook.com' or h.host like '%.fb.com' or h.host like '%.fb.me' then 'facebook'
    when h.host = 'linkedin.com' or h.host like '%.linkedin.com' then 'linkedin'
    when h.host in ('wa.me', 'whatsapp.com')
      or h.host like '%.wa.me' or h.host like '%.whatsapp.com' then 'whatsapp'
    when h.host = 'linktr.ee' or h.host like '%.linktr.ee' then 'linktree'
    when h.host in ('linkin.bio', 'beacons.ai', 'bio.link', 'allmylinks.com', 'carrd.co')
      or h.host like '%.linkin.bio' or h.host like '%.beacons.ai' or h.host like '%.bio.link'
      or h.host like '%.allmylinks.com' or h.host like '%.carrd.co' then 'outro link'
  end as social_platform
) sp;

-- Numeros dos cards do dashboard e contadores das abas, por pais.
create or replace view lead_stats with (security_invoker = true) as
select
  country,
  count(*)::int as total,
  count(*) filter (where is_priority)::int as prospects,
  count(*) filter (where email is not null)::int as with_email,
  count(*) filter (where email is not null and outreach_status = 'pending')::int as pending_to_send,
  count(*) filter (where outreach_status is null or outreach_status = 'pending')::int as not_contacted,
  count(*) filter (where email is not null and outreach_status = 'contacted')::int as email_contacted,
  count(*) filter (
    where (email is null and outreach_status = 'contacted') or whatsapp_template_sent_at is not null
  )::int as whatsapp_contacted,
  count(*) filter (
    where email is not null and (outreach_status is null or outreach_status = 'pending')
  )::int as email_queue_pending
from lead_overview
group by country;

-- Lista de categorias por pais (filtros do dashboard e das filas).
create or replace view lead_category_counts with (security_invoker = true) as
select country, category, count(*)::int as total
from leads
group by country, category;

revoke all on lead_overview, lead_stats, lead_category_counts from anon, authenticated;
