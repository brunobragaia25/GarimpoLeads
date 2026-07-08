# SISTEMA DE PROSPECÇÃO - DOCUMENTAÇÃO COMPLETA

## O que é este projeto?

Sistema automatizado que encontra **50 leads/semana** (advogados, dentistas, etc.) com sites ruins/desatualizados/sem site e busca emails de contato.

**Funciona:**
- Todo dia 08:00 UTC
- Scrapa Google Maps + diretórios públicos
- Analisa sites (WordPress? Lento? Desatualizado?)
- Busca emails (Hunter.io)
- Salva tudo em banco de dados
- Você acessa dashboard, escreve e envia as mensagens manualmente

**Custo:** $0/mês (MVP)
**Tempo:** 10 dias (desenvolvedor solo)
**Stack:** NextJS + Supabase + Hunter.io + Vercel

---

## Como usar esta documentação?

### 1. Se quer ENTENDER tudo
→ Leia **RESUMO_EXECUTIVO.md** primeiro (20 min)
→ Depois **PLANO_TECNICO_PROSPECCAO.md** completo (1-2h)

### 2. Se quer COMEÇAR AGORA
→ Vá direto para **BOILERPLATE_CODIGO.md**
→ Copie e cole o código
→ Siga **CHECKLIST_TROUBLESHOOTING.md**

### 3. Se está DECIDINDO ENTRE OPÇÕES
→ Consulte **MATRIZ_DECISOES.md**

### 4. Se TRAVOU em algo
→ Procure em **CHECKLIST_TROUBLESHOOTING.md** seção "TROUBLESHOOTING"

---

## 📚 Arquivos inclusos

| Arquivo | O quê | Tempo leitura |
|---------|-------|---------------|
| **RESUMO_EXECUTIVO.md** | Visão geral, TL;DR, FAQ | 20 min |
| **PLANO_TECNICO_PROSPECCAO.md** | Arquitetura completa, tudo explicado | 2-3h |
| **BOILERPLATE_CODIGO.md** | Código pronto pra copiar e colar | 1h |
| **CHECKLIST_TROUBLESHOOTING.md** | Passo a passo + erros/soluções | 1-2h |
| **MATRIZ_DECISOES.md** | Comparação entre opções/alternativas | 30 min |
| **README.md** | Este arquivo (índice) | 5 min |

---

## 🚀 Quick Start (5 minutos)

```bash
# 1. Criar projeto
npx create-next-app@latest prospection --typescript --tailwind
cd prospection

# 2. Instalar dependências
npm install @supabase/supabase-js axios cheerio puppeteer lighthouse dotenv

# 3. Criar .env.local com suas API keys
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave
HUNTER_API_KEY=sua-chave
GOOGLE_MAPS_API_KEY=sua-chave
CRON_SECRET=seu-secret-aleatorio

# 4. Copiar código de BOILERPLATE_CODIGO.md
# (seguir estrutura de arquivos lá)

# 5. Rodar
npm run dev

# 6. Testar
curl -X POST http://localhost:3000/api/daily-prospection \
  -H "Authorization: Bearer seu-secret"
```

---

## 📋 Checklist Rápido

### Antes de começar
- [ ] Node.js 18+ (`node -v`)
- [ ] npm 9+ (`npm -v`)
- [ ] Conta Supabase (supabase.com)
- [ ] Conta Hunter.io (hunter.io)
- [ ] Conta Google Cloud (Google Maps API)
- [ ] Conta Vercel (vercel.com)

### Implementação (10 dias)
- [ ] Dia 1: Setup NextJS + Supabase + APIs
- [ ] Dia 2: Database schema
- [ ] Dias 3-4: Scraper Google Maps
- [ ] Dia 5: Análise de site (WordPress detection)
- [ ] Dia 6: Email finder (Hunter.io)
- [ ] Dia 7: Dashboard
- [ ] Dia 8: Scheduler (Vercel Cron)
- [ ] Dia 9-10: Deploy + testes finais

### Result esperado
- [ ] 10-20 leads/dia sendo scraped
- [ ] Emails encontrados automaticamente
- [ ] Tudo salvo no banco de dados
- [ ] Dashboard mostrando resultados
- [ ] Scheduler executando diariamente
- [ ] Você escreve e envia as mensagens manualmente

---

## 🎯 Roadmap

### MVP (Semanas 1-2) ✓ Este projeto
- Scraper básico (Google Maps + 1-2 diretórios)
- Análise de site simples (WordPress detection)
- Email finder (Hunter.io free 100/mês)
- Dashboard básico
- Scheduler diário

**Resultado:** 50 leads/semana descobertos, emails encontrados, mensagens escritas por você

### Fase 2 (Semanas 3-4)
- Scraper expandido (múltiplas fontes)
- Análise avançada (Lighthouse + performance score)
- Email finder robusto (Apollo.io fallback)
- Dashboard profissional (gráficos, filtros)
- Lead scoring (priorizar hot leads)

**Resultado:** Totalmente automatizado, 50-100 leads/semana, dashboards executivos

### Fase 3+ (Futuro)
- Envio automático (WhatsApp Twilio)
- CRM integrado (HubSpot/Pipedrive)
- Tracking de respostas
- A/B testing de mensagens
- Análise de conversão

**Resultado:** Sistema completo end-to-end, do lead à venda

---

## 💰 Custos

### MVP
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Free | $0 |
| Supabase | Free | $0 |
| Hunter.io | Free | $0 (100/mês) |
| Google Maps | Free | $0 (28k/mês) |
| **TOTAL** | | **$0/mês** |

### Fase 2
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Pro | $20 |
| Supabase | Pro | $25-100 |
| Hunter.io | Starter | $49 |
| Google Maps | Pago | $0 (ainda free) |
| **TOTAL** | | **~$95-170/mês** |

---

## 🏗️ Arquitetura

```
Google Maps + Scrapers
        ↓
    NextJS API Routes
    ├─ Scrape leads
    ├─ Analyze sites (WP? Lento?)
    └─ Find emails (Hunter.io)
        ↓
    Supabase Database
    ├─ leads
    ├─ site_analysis
    ├─ outreach
    └─ execution_logs
        ↓
    Vercel Cron (todo dia 08:00 UTC)
        ↓
    Dashboard React
    └─ Visualizar + exportar
```

---

## 📞 Suporte

### Erros comuns? Veja:
→ **CHECKLIST_TROUBLESHOOTING.md** seção "TROUBLESHOOTING"

### Dúvida sobre implementação?
→ **BOILERPLATE_CODIGO.md** tem código pronto

### Dúvida sobre arquitetura?
→ **PLANO_TECNICO_PROSPECCAO.md** tem tudo explicado

### Comparar opções?
→ **MATRIZ_DECISOES.md** compara alternativas

---

## 🎓 Principais Conceitos

### Lead Sourcing
Encontrar prospects através de APIs públicas e scrapers legais.

### Site Analysis
Detectar WordPress, performance lenta, design desatualizado → critério "prospect".

### Email Enrichment
Usar APIs para encontrar emails de contato.

### Automation
Cron scheduler executa pipeline completo todo dia.

---

## 📊 Métricas

### Semana 1
- Leads scraped: 10-20
- Emails found: 5-10
- Taxa sucesso: 50-70%

### Mês 1
- Leads total: 200+
- Emails found: 100+
- Taxa de resposta: depende do nicho

### Conversão esperada
- Lead → contato: 50-70%
- Contato → qualificado: 20-30%
- Qualificado → projeto: 10-20%

---

## ✅ Pré-requisitos

- NextJS: você conhece ✓
- TypeScript: básico é suficiente ✓
- Node.js + npm: instalado ✓
- Git: básico é suficiente ✓
- APIs: tutorial dentro de cada doc ✓

**Não precisa de:**
- DevOps (Vercel faz tudo)
- Machine Learning (IA vem pronta)
- Infraestrutura (tudo cloud)

---

## 🎬 Começar

### Opção 1: Ler primeiro
1. **RESUMO_EXECUTIVO.md** (20 min)
2. **PLANO_TECNICO_PROSPECCAO.md** (2h)
3. **BOILERPLATE_CODIGO.md** (copiar e colar)

### Opção 2: Começar agora
1. **BOILERPLATE_CODIGO.md** (seção "Setup Inicial")
2. Copiar arquivo por arquivo
3. **CHECKLIST_TROUBLESHOOTING.md** se travou

### Opção 3: Decidir antes
1. **MATRIZ_DECISOES.md** (comparar opções)
2. Escolher stack
3. **BOILERPLATE_CODIGO.md**

---

## 📝 Notas

- Todos os arquivos estão em Markdown (compatível com GitHub, VS Code, etc)
- Código é TypeScript/JavaScript (pronto pra rodar)
- SQL scripts já testados (copiar direto no Supabase)
- Exemplos funcionais (não pseudocódigo)
- Passo a passo detalhado (nada ambíguo)

---

## 🎯 Objetivo Final

Você terá um sistema funcionando que:
- ✓ Roda automaticamente todo dia
- ✓ Descobre 10-20 prospects/dia
- ✓ Encontra emails de contato
- ✓ Salva em banco de dados
- ✓ Mostra em dashboard
- ✓ Custa praticamente zero
- ✓ É seu (sem dependência de SaaS)

**Tudo pronto?** Comece com **RESUMO_EXECUTIVO.md**! 

---

**Versão:** 1.0  
**Data:** 2026-07-08  
**Status:** Pronto para uso  
**Suporte:** Consulte os docs acima  

---

**Boa sorte! Você consegue!** 🚀
