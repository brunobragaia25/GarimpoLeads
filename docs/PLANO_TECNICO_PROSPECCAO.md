# SISTEMA DE PROSPECÇÃO - PLANO TÉCNICO COMPLETO

## 1. ARQUITETURA GERAL

```
FONTES → SCRAPE → VALIDAÇÃO → EMAIL → ARMAZENAMENTO → SCHEDULER → DASHBOARD
```

**Fluxo:**
1. **Scrape diário** coleta leads de fontes (Google Maps, scrapers)
2. **Validação de site** detecta WordPress / sites ruins / sem site
3. **Email finder** localiza emails de contato
4. **Armazena** em banco com metadata
5. **Scheduler** executa automaticamente todo dia 08:00 UTC
6. **Dashboard** exibe leads descobertos, taxa sucesso, exporta CSV
7. **Você** escreve e envia a mensagem manualmente pelo dashboard

**Responsabilidades:**
- NextJS API Routes: orquestração, chamadas a APIs externas, validação
- Banco de dados: armazenamento persistent
- Cron job: trigger diário
- Frontend: visualização + gerenciamento

---

## 2. FONTES DE DADOS - COMO PUXAR 50 LEADS/SEMANA

### 2.1 Google Maps API (RECOMENDADO - Mais fácil)
**Implementação:** Busca por categoria + location

```javascript
// api/scrape-google-maps.ts
const googleMapsClient = require('@googlemaps/js-client');

const categories = [
  'advogado',
  'contador',
  'clínica veterinária',
  'dentista',
  'clínica estética',
  'farmácia',
  'agência tech'
];

const states = ['SP', 'MG', 'RJ', 'SC', 'BA', 'RS']; // expandir depois

async function scrapeGoogleMaps() {
  for (const category of categories) {
    for (const state of states) {
      const results = await googleMapsClient.places.nearbysearch({
        location: getStateCenter(state),
        type: category,
        radius: 50000, // 50km
        keyword: category,
        pageToken: null
      });
      
      return results.map(place => ({
        name: place.name,
        phone: place.formatted_phone_number,
        location: place.formatted_address,
        website: place.website,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        category: category,
        source: 'google_maps',
        placeId: place.place_id
      }));
    }
  }
}
```

**Custos:** ~$0.032 por busca (10.000 buscas/mês = ~$320). Cota gratuita: 28.000/mês → sim, cabe 50 leads/semana.

**Limitação:** Precisa de `website` já preenchido no Google Maps. Nem todos têm.

---

### 2.2 Combinação: Scraper de Listas Públicas
**Alternativa:** Scrape de Yellow Pages, diretórios públicos, listas municipais

```javascript
// api/scrape-directories.ts
// Utiliza bibliotecas legais: cheerio (parsing), axios (fetch)

import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapePublicDirectories() {
  // Exemplo: Scraper de Yellow Pages (pt-br equivalent)
  const urls = [
    'https://www.guiamais.com.br/categoria/advogados',
    'https://www.guiamais.com.br/categoria/contadores',
    // ... etc
  ];
  
  const leads = [];
  
  for (const url of urls) {
    const html = await axios.get(url);
    const $ = cheerio.load(html.data);
    
    $('div.business-card').each((i, el) => {
      leads.push({
        name: $(el).find('h2').text(),
        phone: $(el).find('.phone').text(),
        location: $(el).find('.address').text(),
        website: $(el).find('a.website').attr('href'),
        category: extractCategory(url),
        source: 'guia_mais'
      });
    });
  }
  
  return leads;
}
```

**Vantagem:** Encontra empresas SEM site, com telefone válido.
**Cuidado:** Sempre verificar `robots.txt` e termos de serviço antes de scrape.

**Serviços legais (sem scrape manual):**
- **ScrapingBee / Bright Data**: serviços de scrape residencial (pago, mas legal)
- **Dados.gov.br**: dados públicos de CNPJ, registros (gratuito!)
- **Jucerja/cartórios online**: alguns estados expõem registros

---

### 2.3 Integração: Rodar ambos

```javascript
// api/daily-prospection.ts
export default async function handler(req, res) {
  try {
    // 1. Scrape Google Maps
    const gmLeads = await scrapeGoogleMaps();
    
    // 2. Scrape Directories
    const dirLeads = await scrapePublicDirectories();
    
    // 3. Merge + deduplicação
    const allLeads = [...gmLeads, ...dirLeads];
    const deduped = deduplicateLeads(allLeads);
    
    // 4. Próximo step: validação de site
    const validated = await validateSites(deduped);
    
    return res.json({ 
      scraped: allLeads.length, 
      deduplicated: deduped.length,
      validated: validated.length 
    });
  } catch (e) {
    console.error(e);
    await logError(e);
    return res.status(500).json({ error: e.message });
  }
}
```

**Meta realista:** 
- Google Maps: 5-10 leads/dia com site (com website preenchido)
- Directories: 5-10 leads/dia adicional (com ou sem site)
- **Total esperado: 10-20 leads/dia = 50-100/semana**

---

## 3. BUSCA DE EMAILS - COMO ENCONTRAR CONTATOS

### 3.1 APIs Comerciais (Freemium)

| Serviço | Plano Grátis | Custo Pago | Acurácia |
|---------|-------------|-----------|----------|
| **Hunter.io** | 100/mês | $49/mês (1000) | ~95% |
| **Apollo.io** | 500/mês | $99/mês | ~94% |
| **RocketReach** | 50/mês | $129/mês | ~92% |
| **FindThatEmail** | 100/mês | $29/mês | ~85% |

**Recomendação:** Hunter.io (melhor custo-benefício, SDK clean)

### 3.2 Implementação com Hunter.io

```javascript
// api/find-email.ts
import axios from 'axios';

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

async function findEmail(companyName, domain) {
  try {
    const response = await axios.get('https://api.hunter.io/v2/email-finder', {
      params: {
        domain,
        company: companyName,
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${HUNTER_API_KEY}`
      }
    });
    
    return {
      email: response.data?.data?.email,
      confidence: response.data?.data?.confidence, // 0-100
      position: response.data?.data?.position
    };
  } catch (e) {
    console.error('Hunter error:', e);
    return { email: null, confidence: 0 };
  }
}

export async function enrichLeads(leads) {
  const enriched = [];
  
  for (const lead of leads) {
    const domain = extractDomain(lead.website);
    const emailData = await findEmail(lead.name, domain);
    
    enriched.push({
      ...lead,
      email: emailData.email,
      email_confidence: emailData.confidence
    });
  }
  
  return enriched;
}
```

### 3.3 Fallback Gratuito

Se não quiser pagar ainda, use padrões + scrapy manual:

```javascript
// Gerar emails pelo padrão comum
function guessEmails(companyName, domain) {
  const name = companyName.toLowerCase().split(' ')[0];
  return [
    `contato@${domain}`,
    `info@${domain}`,
    `ola@${domain}`,
    `${name}@${domain}`,
    `vendas@${domain}`
  ];
}

// Validar com SMTP check (gratuito)
async function validateEmail(email) {
  // Usar biblioteca: verify-email-address ou nodemailer
  // Apenas sintaxe, sem envio
  const isValid = await verifyEmailSyntax(email);
  return isValid;
}
```

**Estratégia MVP:** Use Hunter grátis (100/mês). Se atingir limite, caia para email patterns + SMTP.

---

## 4. ANÁLISE DE SITE - DETECTAR "RUIM/DESATUALIZADO/WORDPRESS"

### 4.1 O que verificar?

```javascript
// api/analyze-site.ts
interface SiteAnalysis {
  hasSite: boolean;              // Tem site?
  isWordPress: boolean;          // É WordPress?
  lastUpdate: Date | null;       // Última atualização
  performanceScore: number;      // 0-100 (Lighthouse)
  isMobile: boolean;             // É responsivo?
  technology: string[];          // ["WordPress", "Wix", "Shopify", etc]
  designAge: 'modern' | 'old';   // Visual analysis
}
```

### 4.2 Implementação com Puppeteer + Lighthouse

```javascript
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import * as fs from 'fs';

async function analyzeSite(url) {
  if (!url) {
    return { hasSite: false, isWordPress: false };
  }

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // 1. Verificar se site existe
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 5000 });
    
    // 2. Detectar WordPress
    const html = await page.content();
    const isWordPress = html.includes('wp-content') || 
                        html.includes('wp-includes') ||
                        html.includes('wordpress');
    
    // 3. Detectar CMS/Framework
    const technology = detectTechnology(html);
    
    // 4. Analisar data última atualização
    const lastUpdate = extractLastUpdate(html);
    
    // 5. Rodar Lighthouse
    const lighthouseResult = await lighthouse(url, {
      logLevel: 'info',
      output: 'json'
    });
    
    const score = lighthouseResult.lhr.categories.performance.score * 100;
    const mobile = lighthouseResult.lhr.categories['performance'].score > 0.5;
    
    // 6. Score visual (idade do design)
    const designAge = analyzeDesignAge(html);
    
    browser.close();
    
    return {
      hasSite: true,
      isWordPress,
      lastUpdate,
      performanceScore: score,
      isMobile: mobile,
      technology,
      designAge,
      isProspectWorthy: isWordPress || score < 50 || designAge === 'old'
    };
    
  } catch (e) {
    console.error(`Failed to analyze ${url}:`, e);
    return { 
      hasSite: false, 
      error: e.message 
    };
  }
}

function detectTechnology(html) {
  const techs = [];
  if (html.includes('wp-content')) techs.push('WordPress');
  if (html.includes('Wix')) techs.push('Wix');
  if (html.includes('Shopify')) techs.push('Shopify');
  if (html.includes('Webflow')) techs.push('Webflow');
  if (html.includes('joomla')) techs.push('Joomla');
  return techs.length > 0 ? techs : ['Unknown'];
}

function extractLastUpdate(html) {
  // Procura meta tags de último update
  const match = html.match(/<meta[^>]*?(?:last-modified|updated)[^>]*?content="([^"]+)"/i);
  if (match) return new Date(match[1]);
  
  // Alternativa: data do sitemap
  // Alternativa: analisar copyright footer
  return null;
}

function analyzeDesignAge(html) {
  // Heurística: elementos modernos vs antigos
  const modernIndicators = [
    'flexbox', 'grid', 'custom-properties', 'font-display',
    'preload', 'critical', 'aspect-ratio'
  ];
  
  const oldIndicators = [
    'table-layout', 'text-align: center', 'font-tag',
    'spacer.gif', 'flash', 'Java applet'
  ];
  
  const modernCount = modernIndicators.filter(i => html.includes(i)).length;
  const oldCount = oldIndicators.filter(i => html.includes(i)).length;
  
  return oldCount > modernCount ? 'old' : 'modern';
}
```

### 4.3 Critério de "Prospect Válido"

Um lead é **PROSPECT se:**
- Tem site E (WordPress OU performance < 50 OU último update > 2 anos)
- **OU** não tem site

```javascript
function isProspectWorthy(analysis) {
  if (!analysis.hasSite) return true; // Sem site = prospect!
  
  const isWordPress = analysis.isWordPress;
  const isSlow = analysis.performanceScore < 50;
  const isOld = analysis.designAge === 'old';
  
  return isWordPress || isSlow || isOld;
}
```

---

## 5. MENSAGENS PERSONALIZADAS - ENVIO MANUAL

Depois que o lead é encontrado, enriquecido com email e salvo no banco, você mesmo escreve e envia a mensagem de contato diretamente pelo dashboard (WhatsApp, email, etc). Isso evita custo com APIs de geração de texto e mantém o controle total sobre o tom da abordagem.

```javascript
// Salvar registro de outreach ao enviar manualmente
await db.table('outreach').insert({
  lead_id: lead.id,
  message, // texto escrito por você no dashboard
  category: lead.category,
  sent: true,
  sent_at: new Date()
});

// Depois pode:
// - Enviar via WhatsApp API (Twilio, Chatwoot)
// - Enviar via email
// - Agendar envio em horário otimizado
```

**Nível 2 (depois):** A/B test diferentes versões de mensagem, rastrear taxa resposta, iterar abordagem.

---

## 6. SCHEDULER DIÁRIO - COMO RODAR AUTOMATICAMENTE

### 6.1 Opção 1: Vercel Cron (RECOMENDADO)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/daily-prospection",
      "schedule": "0 8 * * *"
    }
  ]
}
```

```typescript
// api/daily-prospection.ts
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Scrape leads
    const leads = await scrapeLeads();
    console.log(`✓ Scraped ${leads.length} leads`);
    
    // 2. Analisar sites
    const analyzed = await analyzeSites(leads);
    const prospects = analyzed.filter(s => isProspectWorthy(s));
    console.log(`✓ Found ${prospects.length} prospects`);
    
    // 3. Enriquecer com emails
    const enriched = await enrichLeads(prospects);
    console.log(`✓ Found ${enriched.filter(e => e.email).length} emails`);
    
    // 4. Salvar tudo
    await saveToDatabase(enriched);
    
    // 5. Log de sucesso
    await logExecution({
      status: 'success',
      scraped: leads.length,
      analyzed: prospects.length,
      emails: enriched.filter(e => e.email).length,
      timestamp: new Date()
    });
    
    return res.json({ 
      success: true,
      summary: {
        scraped: leads.length,
        prospects: prospects.length,
        emails: enriched.filter(e => e.email).length
      }
    });
    
  } catch (error) {
    console.error('Daily prospection error:', error);
    await logError({
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    return res.status(500).json({ error: error.message });
  }
}
```

**Vantagem:** Sem custo extra, integrado com Vercel, super confiável.

### 6.2 Opção 2: node-cron (Para dev local + Render/Railway)

```typescript
import cron from 'node-cron';

// Executar todo dia 08:00 UTC
cron.schedule('0 8 * * *', async () => {
  console.log('🚀 Starting daily prospection...');
  
  try {
    const result = await runDailyProspection();
    console.log('✓ Success:', result);
  } catch (error) {
    console.error('✗ Error:', error);
    await notifyError(error);
  }
});
```

**Setup:**
```bash
npm install node-cron
```

**Desvantagem:** Requer servidor sempre ligado (custo com Railway/Render).

### 6.3 Opção 3: GitHub Actions (Gratuito, sem servidor)

```yaml
# .github/workflows/daily-prospection.yml
name: Daily Prospection

on:
  schedule:
    - cron: '0 8 * * *'  # Todo dia 08:00 UTC

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Run prospection
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          HUNTER_API_KEY: ${{ secrets.HUNTER_API_KEY }}
          GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}
        run: |
          npm install
          node scripts/daily-prospection.js
```

**Vantagem:** Gratuito, sem servidor.
**Desvantagem:** Menos confiável (GitHub pode ter downtime).

---

## 7. ARMAZENAMENTO - BANCO DE DADOS

### 7.1 Schema Supabase (PostgreSQL)

```sql
-- Tabela: leads
CREATE TABLE leads (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  email_confidence INT,  -- 0-100
  website VARCHAR(500),
  category VARCHAR(100),
  source VARCHAR(100),   -- 'google_maps', 'guia_mais', etc
  lat DECIMAL,
  lng DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: site_analysis
CREATE TABLE site_analysis (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  has_site BOOLEAN,
  is_wordpress BOOLEAN,
  last_update TIMESTAMP,
  performance_score INT,
  is_mobile BOOLEAN,
  technology TEXT[],  -- ARRAY type
  design_age VARCHAR(50),  -- 'modern', 'old'
  is_prospect BOOLEAN,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: outreach
CREATE TABLE outreach (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  message TEXT,
  category VARCHAR(100),
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  response_status VARCHAR(50),  -- 'no_response', 'replied', 'interested', 'rejected'
  reply_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: execution_logs
CREATE TABLE execution_logs (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(50),  -- 'success', 'error', 'partial'
  leads_scraped INT,
  leads_analyzed INT,
  emails_found INT,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_leads_category ON leads(category);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_site_analysis_is_prospect ON site_analysis(is_prospect);
CREATE INDEX idx_outreach_lead_id ON outreach(lead_id);
```

### 7.2 Setup Supabase

1. Criar conta: https://supabase.com
2. Criar projeto (região mais próxima)
3. Copiar `CONNECTION_STRING` (encontrar em Settings → Database)
4. Instalar cliente:

```bash
npm install @supabase/supabase-js
```

5. Usar em API routes:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Inserir lead
await supabase.from('leads').insert({
  name: 'João da Silva',
  phone: '11999999999',
  email: 'joao@empresa.com',
  website: 'https://joao.com.br',
  category: 'advogado',
  source: 'google_maps'
});

// Consultar prospects
const { data } = await supabase
  .from('site_analysis')
  .select('leads(*), site_analysis(*)')
  .eq('is_prospect', true)
  .is('outreach.sent', false);
```

### 7.3 Alternativa: Firebase Firestore

Se preferir NoSQL:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inserir
await addDoc(collection(db, 'leads'), {
  name: 'João da Silva',
  category: 'advogado',
  website: 'https://joao.com.br',
  timestamp: new Date()
});
```

**Recomendação:** Supabase é mais barato + SQL é melhor para analytics depois.

---

## 8. MVP vs FASE 2 - ROADMAP

### MVP (Semanas 1-2)
- [ ] Setup NextJS + Supabase
- [ ] Scraper Google Maps básico (1-2 categorias)
- [ ] Análise WordPress simples (apenas checar `wp-content`)
- [ ] Hunter.io integrado (100 emails/mês grátis)
- [ ] Scheduler manual (você executa `/api/daily-prospection` manualmente via curl)
- [ ] Dashboard básica (tabela com leads)
- [ ] Export CSV

**Esforço:** ~40 horas (desenvolvedor solo)
**Resultado:** Sistema funcional, gerando 5-10 prospects/dia, 100% manual

### Fase 2 (Semanas 3-4)
- [ ] Scraper directories expandido (múltiplas fontes)
- [ ] Lighthouse integrado (análise performance real)
- [ ] Detecção de últimas atualizações
- [ ] Multiple email finder (Apollo.io fallback)
- [ ] Verificação SMTP gratuita (para validar emails guess)
- [ ] Scheduler automático (Vercel Cron)
- [ ] Dashboard com gráficos (leads/dia, taxa sucesso)
- [ ] Histórico de execuções

**Esforço:** ~30 horas
**Resultado:** Totalmente automatizado, 10-20 prospects/dia, zero manual

### Fase 3+ (Futuro)
- [ ] Envio automático via WhatsApp (Twilio)
- [ ] Rastreamento de respostas
- [ ] A/B testing de mensagens
- [ ] Lead scoring (priorizar hot leads)
- [ ] Integração CRM (Pipedrive, HubSpot)
- [ ] Análise de conversão (quanto de cada lead vira projeto?)
- [ ] Geolocalização inteligente (priorizar cidades específicas)
- [ ] Blacklist (já prospectado? não scrape de novo)

---

## 9. PASSO A PASSO IMPLEMENTAÇÃO

### Dia 1: Setup Base
```bash
# 1. Criar Next.js project
npx create-next-app@latest prospection --typescript --tailwind

# 2. Instalar dependências
npm install \
  @supabase/supabase-js \
  axios \
  cheerio \
  puppeteer \
  lighthouse \
  @googlemaps/js-client \
  dotenv

# 3. Criar arquivo .env.local
cat > .env.local << EOF
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
DATABASE_URL=postgresql://xxx
HUNTER_API_KEY=xxx
GOOGLE_MAPS_API_KEY=xxx
CRON_SECRET=seu-secret-aleatorio
EOF
```

### Dia 2-3: Scraper Google Maps
- [ ] Criar `lib/google-maps.ts` com função `scrapeGoogleMaps()`
- [ ] Testar com 1 categoria
- [ ] Verificar deduplicação

### Dia 4: Análise de Site
- [ ] Criar `lib/site-analyzer.ts` com `analyzeSite()`
- [ ] Integrar Puppeteer + Lighthouse
- [ ] Testar com 10 URLs

### Dia 5: Email Finder
- [ ] Integrar Hunter.io
- [ ] Criar fallback com email patterns
- [ ] Testar validação SMTP gratuita

### Dia 6: Integração Banco
- [ ] Criar schema Supabase
- [ ] Conectar Supabase client
- [ ] Salvar leads/análises

### Dia 7: API Routes
- [ ] Criar `/api/daily-prospection` completo
- [ ] Integrar todas as funções
- [ ] Testes end-to-end

### Dia 8: Dashboard
- [ ] Criar página inicial com tabela de leads
- [ ] Botões de ação (exportar, revisar, etc)
- [ ] Filtros por categoria/fonte

### Dia 9-10: Deploy + Scheduler
- [ ] Deploy no Vercel
- [ ] Configurar `vercel.json` com cron
- [ ] Testes com primeira execução automática

---

## 10. CÓDIGO EXEMPLO - API ROUTES COMPLETO

### `/api/daily-prospection.ts` (Main Orchestrator)

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { scrapeGoogleMaps } from '@/lib/google-maps';
import { scrapeDirectories } from '@/lib/scrapers';
import { analyzeSites } from '@/lib/site-analyzer';
import { enrichWithEmails } from '@/lib/email-finder';
import { saveLeads, saveAnalysis, logExecution } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Segurança: verificar CRON_SECRET
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const startTime = Date.now();
    console.log('🚀 Starting daily prospection...');

    // 1. SCRAPE
    const gmLeads = await scrapeGoogleMaps();
    const dirLeads = await scrapeDirectories();
    const allLeads = [...gmLeads, ...dirLeads];
    const deduped = deduplicateLeads(allLeads);
    
    console.log(`✓ Scraped: ${allLeads.length} leads, Deduped: ${deduped.length}`);

    // 2. ANALYZE SITES
    const analyzed = await analyzeSites(deduped);
    const prospects = analyzed.filter(a => a.is_prospect);
    
    console.log(`✓ Analyzed: ${analyzed.length}, Prospects: ${prospects.length}`);

    // 3. FIND EMAILS
    const enriched = await enrichWithEmails(prospects);
    const withEmail = enriched.filter(e => e.email);
    
    console.log(`✓ Enriched with emails: ${withEmail.length}`);

    // 4. SAVE TO DATABASE
    await saveLeads(enriched);
    await saveAnalysis(analyzed);

    // 5. LOG EXECUTION
    const duration = (Date.now() - startTime) / 1000;
    await logExecution({
      status: 'success',
      leads_scraped: allLeads.length,
      leads_analyzed: analyzed.length,
      leads_prospect: prospects.length,
      emails_found: withEmail.length,
      duration_seconds: duration
    });

    console.log(`✓ Completed in ${duration}s`);

    return res.status(200).json({
      success: true,
      summary: {
        scraped: allLeads.length,
        prospects: prospects.length,
        emails: withEmail.length,
        duration_seconds: duration
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error);

    await logExecution({
      status: 'error',
      error_message: error.message,
      error_stack: error.stack
    });

    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function deduplicateLeads(leads: any[]) {
  const seen = new Map();
  const deduped = [];

  for (const lead of leads) {
    // Chave: nome + telefone
    const key = `${lead.name}|${lead.phone}`;
    
    if (!seen.has(key)) {
      seen.set(key, true);
      deduped.push(lead);
    }
  }

  return deduped;
}
```

---

## 11. ESTIMATIVAS DE CUSTO

### Custos Mensais

| Serviço | Plano | Custo |
|---------|-------|-------|
| **Vercel** | Pro (recomendado) | $20 |
| **Supabase** | Free (até 500MB) → Pro | $25-100 |
| **Hunter.io** | Free (100/mês) → Starter | $49 |
| **Google Maps API** | 28k buscas grátis | $0 → $320 |
| **Puppeteer (browser)** | Inclusive no hosting | $0 |
| **GitHub Actions** | Gratuito | $0 |
| | **TOTAL** | **~$90-190/mês** |

**Redução de custo (MVP):**
- Use free tiers: Hunter (100/mês), Google Maps (28k)
- Hospede no Render/Railway (free tier): $0
- Use GitHub Actions (gratuito)
- **TOTAL MVP: $0/mês**

---

## 12. CHECKLIST FINAL

MVP (Pronto em 2 semanas):
- [ ] NextJS boilerplate + Supabase setup
- [ ] Google Maps scraper (1-2 categorias)
- [ ] Site analyzer (WordPress detection básico)
- [ ] Hunter.io integrado
- [ ] Dashboard com tabela
- [ ] CSV export
- [ ] Manual `/api/daily-prospection` trigger

Fase 2 (Pronto em 4 semanas):
- [ ] Scraper directories expandido
- [ ] Lighthouse real
- [ ] Scheduler automático (Vercel Cron)
- [ ] Dashboard com gráficos
- [ ] Logs de execução

---

## RECURSOS ÚTEIS

- Documentação NextJS: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Hunter.io API: https://hunter.io/api-documentation
- Puppeteer: https://pptr.dev
- Lighthouse: https://github.com/GoogleChrome/lighthouse
- Google Maps API: https://developers.google.com/maps/documentation/places/web-service/search

---

**Você está pronto para começar!** O stack é 100% NodeJS/NextJS, custo baixo, e escalável. Comece pelo MVP, adicione automatização depois.
