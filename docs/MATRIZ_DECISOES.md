# MATRIZ DE DECISÕES - ESCOLHENDO ENTRE OPÇÕES

## 1. BANCO DE DADOS

| Critério | Supabase | Firebase | PostgreSQL Local |
|----------|----------|----------|------------------|
| **Setup** | 5 min | 5 min | 30 min |
| **Custo** | Free até 500MB | Free até 1GB | Grátis (você instala) |
| **SQL** | ✓ Sim | ✗ Não (NoSQL) | ✓ Sim |
| **Analytics** | ✓ Excelente | ✗ Ruim | ✓ Possível |
| **Escalabilidade** | ✓ Automática | ✓ Automática | ✗ Manual |
| **Para MVP** | ✓✓✓ RECOMENDADO | ✓✓ Funciona | ✗ Overhead |

**Escolha:** **Supabase** (melhor balance SQL + simplicidade + preço)

---

## 2. FONTE DE DADOS - LEADS

| Fonte | Volume | Qualidade | Custo | Setup |
|-------|--------|-----------|-------|-------|
| **Google Maps** | 5-10/dia | Alta (Google valida) | Free (28k/mês) | 2h |
| **Web Scrape** | 5-20/dia | Média (depende site) | Free/Custom | 4h |
| **Yellow Pages** | 10-30/dia | Média | $$ por scrape | 3h |
| **API públicas** | 1-5/dia | Alta | Free/Pago | 5h |
| **Manual** | ? | Muito alta | Seu tempo | ✗ |

**Estratégia MVP:** Google Maps + 1 scraper público

**Total esperado:** 10-20 leads/dia → 50-100/semana ✓

---

## 3. EMAIL FINDER - QUAL API?

| API | Free/Mês | Acurácia | Custo Pago | Fallback |
|-----|----------|----------|-----------|----------|
| **Hunter.io** | 100 | 95% | $49 | Pattern + SMTP |
| **Apollo.io** | 500 | 94% | $99 | Pattern + SMTP |
| **RocketReach** | 50 | 92% | $129 | Pattern + SMTP |
| **FindThatEmail** | 100 | 85% | $29 | Pattern + SMTP |
| **Nenhuma (patterns)** | ∞ | 40% | $0 | N/A |

**Estratégia MVP:** Hunter.io (100 grátis/mês é suficiente para 1-2 semanas)

**Se atingir limite:** Cair pra pattern guess + SMTP (código no boilerplate)

**Custo total:** $0 ou $49/mês na Fase 2

---

## 4. ANÁLISE DE SITE - QUE TECNOLOGIA?

| Tecnologia | WP Detection | Performance | Last Update | Custo | Setup |
|-----------|--------------|-------------|-------------|-------|-------|
| **Puppeteer** | ✓ HTML parsing | ✗ Manual | ✓ Meta tags | $0 | 2h |
| **Lighthouse** | ✓ Sim | ✓✓ Profissional | ✗ Não | $0 | 3h |
| **WebPageTest** | ✓ Sim | ✓✓✓ Muito bom | ✗ Não | $$ | 1h |
| **Herowkai** | ✓ Sim | ✓ Bom | ✗ Não | $$ | 1h |
| **Simples (regex)** | ✓ Sim | ✗ Nenhuma | ✓ Básico | $0 | 30m |

**MVP:** Puppeteer + regex simples (detectar wp-content, design age heurístico)

**Fase 2:** Integrar Lighthouse real para performance score profissional

---

## 5. GERAÇÃO DE MENSAGENS - IA QUAL MODELO?

| Modelo | Custo | Qualidade | Latência | Para MVP |
|--------|-------|-----------|----------|----------|
| **Claude 3.5 Sonnet** | $10 por 1M tokens | ✓✓✓ Excelente | Rápido | ✓ RECOMENDADO |
| **GPT-4 Turbo** | $10 por 1M tokens | ✓✓✓ Excelente | Rápido | ✓ Funciona |
| **GPT-3.5** | $0.50 por 1M tokens | ✓✓ Bom | Rápido | ✓ Mais barato |
| **Mistral** | $0.27 por 1M tokens | ✓✓ OK | Rápido | ✓ Mais barato |
| **Llama 2 Local** | $0 | ✓✓ OK | Lento | ✗ Overhead |

**MVP:** Claude 3.5 Sonnet (~$10/mês para 1000 mensagens)

**Se budget apertado:** GPT-3.5 ou Mistral (5x mais barato, qualidade ok)

---

## 6. SCHEDULER - COMO RODAR DIARIAMENTE?

| Opção | Setup | Confiabilidade | Custo Extra | Recomendação |
|-------|-------|-----------------|-------------|--------------|
| **Vercel Cron** | 1 arquivo (vercel.json) | ✓✓✓ Alta | $0 | ✓✓✓ BEST |
| **node-cron** | 3 linhas código | ✓✓ Média | Servidor ($10-20/mês) | ✓✓ SE TIVER SERVIDOR |
| **GitHub Actions** | 20 linhas YAML | ✓✓ Média | $0 | ✓✓ Alternativa free |
| **AWS Lambda** | 30 min setup | ✓✓✓ Alta | Pode ser free tier | ✓ Se já usa AWS |
| **Cron local** | Automático | ✗ Precisa PC ligado | $0 | ✗ Não usar |

**MVP:** Vercel Cron (integrado, zero config extra, 100% confiável)

---

## 7. HOSTING - ONDE FAZER DEPLOY?

| Host | Custo | Setup | Cron Support | Database |
|------|-------|-------|--------------|----------|
| **Vercel** | Free/20$ | 2 min | ✓ Nativo | Supabase externo |
| **Railway** | Free/5-25$ | 5 min | node-cron | Supabase externo |
| **Render** | Free/7$ | 5 min | node-cron | Supabase externo |
| **AWS EC2** | Free tier/10-50$ | 30 min | ✓ Qualquer | Supabase externo |
| **Heroku** | ✗ Descontinuado | N/A | N/A | N/A |

**MVP:** Vercel (parceira oficial Next.js, Cron nativo, free)

**Alternativa:** Railway (melhor que Render, mais barato que AWS)

---

## 8. FRONTEND - COMO VISUALIZAR DADOS?

| Framework | Setup | Dashboard Rápido | Exportar CSV |
|-----------|-------|------------------|--------------|
| **React puro** | 1h | ✓✓ Manual | ✗ Manual |
| **Next.js Pages** | 30m | ✓✓ Sim | ✓ Com lib |
| **Shadcn/ui** | 2h | ✓✓✓ Componentes | ✓ Sim |
| **React Admin** | 3h | ✓✓✓ Automático | ✓ Sim |
| **Retool/Budibase** | 30m | ✓✓✓✓ Zero code | ✓ Sim | ✗ Custoso |

**MVP:** Next.js Pages + React simples (tabela HTML + botões)

**Fase 2:** Adicionar Shadcn/ui pra ficando mais profissional

---

## 9. NOTIFICAÇÕES - COMO AVISAR DE NOVOS LEADS?

| Método | Setup | Custo | Para MVP |
|--------|-------|-------|----------|
| **Email (SendGrid)** | 2h | Free/Pago | ✓ Sim |
| **Slack** | 1h | Free | ✓ Sim |
| **WhatsApp (Twilio)** | 3h | $15/mês | ✗ Depois |
| **Push notification** | 4h | $$ | ✗ Depois |
| **Dashboard polling** | 0h | $0 | ✓ MVP é suficiente |

**MVP:** Sem notificações (você acessa dashboard)

**Fase 2:** Slack webhook (avisar quando novo lead)

---

## 10. SCALING - COMEÇAR PEQUENO, CRESCER DEPOIS

### MVP (Semana 1-2)
```
2 categorias (advogado, dentista)
2 estados (SP, RJ)
~10 leads/dia
Hunter.io free
Claude AI ~$5/mês
Custo total: $5-10/mês
```

### Fase 2 (Semana 3-4)
```
5 categorias
5 estados
~25 leads/dia
Hunter.io starter ($49/mês)
Lighthouse integrado
Custo total: $50-80/mês
```

### Scaling (Mês 2+)
```
10+ categorias
Brasil inteiro
~50-100 leads/dia
WhatsApp/Email automático
CRM integrado
Lead scoring
Custo total: $200-500/mês
```

---

## MATRIZ DE DECISÃO - SEU CASO ESPECÍFICO

### Se quer RÁPIDO (2-3 dias)
✓ Google Maps simples
✓ Hunter.io free
✓ Claude IA
✓ Vercel Cron
✓ Dashboard HTML puro
**Tempo:** 30h
**Custo:** $5-10/mês

### Se quer CONFIÁVEL (mas take mais tempo)
✓ Google Maps + 2 scrapers
✓ Hunter.io + Apollo.io fallback
✓ Lighthouse + análise avançada
✓ GitHub Actions backup
✓ Dashboard React completo
**Tempo:** 60h
**Custo:** $50-100/mês

### Se quer SIMPLES E BARATO
✓ Google Maps simples
✓ Email patterns + SMTP
✓ Claude IA
✓ Vercel Cron
✓ Dashboard básico
**Tempo:** 25h
**Custo:** $0-5/mês

### Se quer PRODUÇÃO DIA 1
✓ Usar template pronto (Next.js boilerplate)
✓ Supabase hosted
✓ APIs comerciais
✓ Vercel deploy automático
✓ Dashboard Shadcn
**Tempo:** 40h
**Custo:** $50/mês (mas 100% profissional)

---

## RECOMENDAÇÃO FINAL PARA VOCÊ

**Sua situação:**
- Sabe NextJS ✓
- Pode fazer deploy sozinho ✓
- Quer prático, não especular ✓
- Volume: 50 leads/semana ✓

**Stack recomendado:**
```
Frontend:        Next.js 14 (Você conhece)
Backend:         API Routes (Integrado)
Database:        Supabase (Free + SQL)
Scraping:        Google Maps + axios/cheerio
Email:           Hunter.io (free 100/mês)
IA:              Claude 3.5 Sonnet ($10/mês)
Scheduler:       Vercel Cron (nativo)
Deploy:          Vercel (parceira oficial)
Total MVP:       $10-20/mês
Total Fase 2:    $60-100/mês
```

**Por quê?**
- Zero overhead (tudo que sabe já)
- Custo mínimo (free tiers aproveitados)
- Deploy simples (Vercel = 1 clique)
- Escalável (pode crescer linear)
- Manutenção fácil (você conhece stack)

---

## DECISÃO FINAL: O QUE FAZER PRIMEIRO?

### Ordem de implementação (MVP)

1. **Setup (2h)**
   - NextJS + Supabase
   - APIs (Hunter, Anthropic, Google Maps)

2. **Database (1h)**
   - Criar tabelas no Supabase

3. **Scraper (4h)**
   - Google Maps simples
   - 2 categorias, 2 estados

4. **Site Analysis (3h)**
   - Puppeteer + regex
   - WP detection básico

5. **Email Finder (2h)**
   - Hunter.io integrado
   - Fallback patterns

6. **IA (2h)**
   - Claude + prompts
   - 1 template por categoria

7. **Orchestration (3h)**
   - API route que coordena tudo

8. **Dashboard (2h)**
   - Tabela HTML simples
   - Botão de execução

9. **Scheduler (1h)**
   - vercel.json com Cron

10. **Deploy (1h)**
    - Push GitHub → auto deploy Vercel

**Total: ~21 horas (3 dias de trabalho integral)**

---

## DOCUMENTO FINAL

Você tem:
1. **PLANO_TECNICO_PROSPECCAO.md** - Tudo detalhado
2. **BOILERPLATE_CODIGO.md** - Código pronto
3. **CHECKLIST_TROUBLESHOOTING.md** - Passo a passo
4. **RESUMO_EXECUTIVO.md** - Visão executiva
5. **MATRIZ_DECISOES.md** - Este documento (alternativas)

**Próximo passo:** Escolher stack acima, começar pelo boilerplate.

**Sucesso!** 🚀
