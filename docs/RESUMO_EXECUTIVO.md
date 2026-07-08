# RESUMO EXECUTIVO - SISTEMA DE PROSPECÇÃO

## O QUÊ?

Sistema automatizado que encontra **50 leads/semana** com sites ruins, desatualizados ou sem site, e localiza emails de contato.

**Nichos:** Advogados, contadores, dentistas, vet, estética, farmácia, tech — Brasil inteiro.

---

## COMO FUNCIONA?

```
Dia 1, 08:00 UTC:
1. Raspa 10-20 leads (Google Maps + diretórios públicos)
2. Analisa cada site (WordPress? Lento? Desatualizado?)
3. Busca emails de contato (Hunter.io)
4. Salva tudo no banco de dados
5. Você acessa dashboard, escreve e envia mensagens manualmente
```

---

## STACK

| Componente | Tecnologia |
|-----------|-----------|
| **Frontend** | Next.js 14 (TypeScript) |
| **Backend** | API Routes (Next.js) |
| **Database** | Supabase (PostgreSQL) |
| **Scraping** | Google Maps API + axios/cheerio |
| **Email** | Hunter.io (free: 100/mês) |
| **Scheduler** | Vercel Cron (ou GitHub Actions) |
| **Deploy** | Vercel (gratuito ou $20/mês) |

---

## CUSTO INICIAL

| Item | Custo |
|------|-------|
| Vercel | Grátis (ou $20/mês) |
| Supabase | Grátis (até 500MB) |
| Hunter.io | Grátis (100/mês) |
| Google Maps | Grátis (28k buscas/mês) |
| **TOTAL** | **~$0-20/mês** |

---

## IMPLEMENTAÇÃO

### Tempo estimado: 10 dias (desenvolvedor solo)

```
Dia 1: Setup (NextJS, Supabase, APIs)
Dia 2: Database schema
Dias 3-4: APIs de scrape + análise
Dia 5: Email finder
Dia 6: Integração banco
Dia 7: Scheduler
Dia 8: Dashboard
Dia 9-10: Deploy + testes
```

### Esforço
- **MVP (dias 1-6):** 35 horas
- **Fase 2 com automação (dias 7-10):** 20 horas
- **Total:** 55 horas

---

## O QUE JÁ TEMOS PRONTO?

Documentos criados (3 arquivos):

1. **PLANO_TECNICO_PROSPECCAO.md** — Tudo explicado em detalhes
   - Arquitetura completa
   - Fontes de dados (como puxar leads)
   - APIs de email
   - Análise de site
   - Scheduler options
   - Database schema
   - Roadmap MVP/Fase 2

2. **BOILERPLATE_CODIGO.md** — Código pronto pra copiar e colar
   - Setup inicial (npm install, .env)
   - Estrutura de pastas
   - Tipos TypeScript
   - Cliente Supabase
   - Cada API route completa
   - Dashboard React
   - Deploy Vercel

3. **CHECKLIST_TROUBLESHOOTING.md** — Passo a passo + solução de problemas
   - Checklist por fase
   - Como testar cada parte
   - Troubleshooting (10+ erros comuns)
   - Performance tips
   - Testing checklist

---

## ARQUITETURA VISUAL

```
FONTES DE DADOS
├─ Google Maps API (10 leads/dia)
├─ Web Scraper (10 leads/dia)
└─ Diretórios públicos

           ↓

NEXTJS API ROUTES
├─ /api/scrape-google-maps
├─ /api/analyze-site (WordPress? Lento?)
└─ /api/find-email (Hunter.io)

           ↓

SUPABASE DATABASE
├─ leads (nome, tel, email, site)
├─ site_analysis (WP? score? é prospect?)
├─ outreach (mensagens enviadas manualmente)
└─ execution_logs (histórico)

           ↓

SCHEDULER (todo dia 08:00 UTC)
├─ Vercel Cron (recomendado)
├─ ou node-cron
└─ ou GitHub Actions

           ↓

DASHBOARD (React)
├─ Tabela de leads
├─ Filtros por categoria
├─ Export CSV
└─ Histórico de execuções
```

---

## DECISÕES IMPORTANTES

### 1. Por que NextJS?
- Você já conhece
- API Routes = backend integrado
- Deploy simples (Vercel é parceira oficial)
- TypeScript built-in

### 2. Por que Supabase?
- PostgreSQL grátis até 500MB
- Simple + poderoso para scale
- Interface intuitiva
- Melhor que Firebase para SQL queries depois

### 3. Por que Hunter.io?
- Free: 100 emails/mês
- Acurácia: ~95%
- SDK clean
- Fallback simples com patterns

### 4. Por que Vercel Cron?
- Sem servidor extra
- Sem custo adicional
- Confiável
- Integrado com Next.js

---

## FLUXO DE DADOS COMPLETO

```javascript
// TODO DIA 8:00 UTC
async function dailyProspection() {
  
  // 1. SCRAPE
  const leads = [
    { name: 'Silva Advocacia', phone: '11999999999', website: 'https://silva-adv.com.br', category: 'advogado' },
    // ... 9-19 leads mais
  ];
  
  // 2. ANALISAR SITES
  const analyzed = [
    { ...leads[0], is_wordpress: true, is_prospect: true },
    // ...
  ];
  
  // 3. FIND EMAILS
  const enriched = [
    { ...analyzed[0], email: 'silva@silva-adv.com.br', email_confidence: 85 },
    // ...
  ];
  
  // 4. SALVAR
  await saveLeads(enriched);
  await saveAnalysis(analyzed);
  
  // RESULTADO
  console.log('✓ 15 leads encontrados');
  console.log('✓ 10 emails localizados');
  console.log('✓ Salvo no banco de dados');
  
  // VOCÊ VÊ NO DASHBOARD
  // Dashboard mostra tabela com leads
  // Você clica em cada um e envia a mensagem manualmente
}
```

---

## INTEGRAÇÃO COM FERRAMENTAS FUTURAS

### Fase 3: Envio Automático

```javascript
// Após dominar o MVP, integrar:

// WhatsApp (Twilio)
async function sendViaWhatsApp(lead, message) {
  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  
  await twilio.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: lead.phone
  });
}

// Email (SendGrid)
async function sendViaEmail(lead, message) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  await sgMail.send({
    to: lead.email,
    from: 'hello@prospeccao.com',
    subject: `${lead.name}, sua presença online pode melhorar`,
    html: message
  });
}

// CRM (HubSpot / Pipedrive)
async function sendToCRM(lead) {
  const hubspot = require('@hubspot/api-client');
  // criar contato em HubSpot
}
```

---

## PRÓXIMAS ANÁLISES POSSÍVEIS

Depois do MVP, adicionar:

```javascript
// Lead Scoring
function scoreLeadHotness(lead) {
  let score = 0;
  
  if (lead.is_wordpress) score += 20;           // WordPress = pronto pra vender
  if (lead.performance_score < 30) score += 30; // Muito lento
  if (lead.email_confidence > 90) score += 20;  // Email verificado
  if (!lead.has_site) score += 30;              // Sem site = super quente
  
  return score; // 0-100
}

// Geolocalização
function prioritizeCities(leads, myCity) {
  // Priorizar prospects na minha cidade/estado
  return leads.sort((a, b) => 
    distance(a.lat, a.lng, myCity.lat, myCity.lng) -
    distance(b.lat, b.lng, myCity.lat, myCity.lng)
  );
}

// Blacklist
async function filterBlacklisted(leads) {
  const blacklist = await supabase
    .from('blacklist')
    .select('email');
  
  const blacklistSet = new Set(blacklist.data.map(b => b.email));
  return leads.filter(l => !blacklistSet.has(l.email));
}

// Conversion Tracking
async function trackConversions(lead) {
  const outreach = await supabase
    .from('outreach')
    .select('response_status')
    .eq('lead_id', lead.id);
  
  // Calcular taxa de conversão por categoria
  // Refinar abordagem de mensagem baseado em respostas
}
```

---

## LINKS ÚTEIS

### Documentação oficial
- NextJS: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- TypeScript: https://www.typescriptlang.org/docs
- Vercel: https://vercel.com/docs

### APIs
- Hunter.io: https://hunter.io/api-documentation
- Google Maps: https://developers.google.com/maps/documentation
- Puppeteer: https://pptr.dev

### Ferramentas
- VS Code: https://code.visualstudio.com
- Git: https://git-scm.com/doc
- Supabase CLI: https://supabase.com/docs/reference/cli

### Alternativas (se quiser mudar stack)
- Firebase (en vez Supabase)
- RocketReach / Apollo (en vez Hunter)
- Selenium (en vez Puppeteer)
- GitHub Actions (en vez Vercel Cron)

---

## COMANDOS IMPORTANTES

```bash
# Setup
npx create-next-app@latest prospection --typescript --tailwind
cd prospection
npm install @supabase/supabase-js axios cheerio puppeteer lighthouse dotenv

# Desenvolvimento
npm run dev          # Rodar localhost:3000
npm run build        # Build para produção
npm run lint         # Verificar código

# Supabase
supabase link        # (se usar CLI)
supabase start       # Rodar local

# Deploy
git push origin main # Auto-deploy no Vercel

# Testing
curl -X POST http://localhost:3000/api/daily-prospection \
  -H "Authorization: Bearer seu-secret"
```

---

## MÉTRICAS PRA ACOMPANHAR

### Semana 1
- Leads scraped: 10-20
- Emails found: 5-10
- Mensagens enviadas manualmente: 10-20

### Semana 4
- Leads scrapped: 50+
- Emails found: 25+
- Mensagens enviadas: 50+
- Taxa de erro: < 5%

### Mês 1
- Total de leads: 200+
- Unique emails: 100+
- Taxa de resposta: ? (depende do nicho)
- Conversion rate (lead → projeto): ? (depende da mensagem)

---

## FAQ

**P: Posso rodar isso local sem deploy?**
R: Sim, `npm run dev` funciona local. Mas o scheduler não roda (precisa Vercel/Railway/Actions).

**P: Preciso de cartão de crédito?**
R: Não para MVP. Hunter (free 100/mês), Google Maps (free 28k/mês), Supabase (free 500MB), Vercel (free).

**P: Como não spam?**
R: Seus leads são de fontes legais (Google Maps público, diretórios legais). Mensagem é consultiva (não agressiva). Sempre ofereça unsubscribe.

**P: Pode crescer?**
R: Sim. Começar com 2 categorias, depois expande. Scale é linear (mais API calls = mais leads).

**P: Quanto gasto em APIs?**
R: MVP: ~$0-20/mês. Em scale (1000+ leads/mês): ~$100-300/mês.

**P: Integro com WhatsApp depois?**
R: Sim! Seção 3 mostra como. Primeira fase é descobrir leads, segunda é automatizar envio.

**P: E se tiver muitos erros?**
R: Logs salvos em Supabase. Vercel dashboard mostra erros. `console.log` na sua dashboard.

---

## PRÓXIMOS PASSOS

### Hoje
1. Ler PLANO_TECNICO_PROSPECCAO.md
2. Entender arquitetura
3. Setup Supabase + APIs

### Semana 1
4. Implementar usando BOILERPLATE_CODIGO.md
5. Testar com checklist
6. Deploy no Vercel

### Semana 2
7. Primeira execução automática (Cron)
8. Dashboard funcionando
9. 50+ leads no banco

### Semana 3+
10. Integrar envio (WhatsApp/Email)
11. Rastrear respostas
12. Iterar abordagem de mensagem baseado em feedback

---

## SUPORTE

Se travar:
1. Verificar CHECKLIST_TROUBLESHOOTING.md
2. Procurar erro exato em "TROUBLESHOOTING"
3. Seguir solução
4. Se não resolveu: adicionar `console.log()` pra debug

---

## TL;DR

**Sistema que roda todo dia 08:00, encontra 10-20 leads com sites ruins, busca emails, salva no banco. Você vê no dashboard, escreve e envia mensagens quando quiser.**

**Stack:** NextJS + Supabase + Hunter.io + Vercel

**Custo:** ~$0-20/mês

**Tempo:** 10 dias

**Pronto pra começar!** 🚀
