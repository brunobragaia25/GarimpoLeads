# BOILERPLATE - CÓDIGO PRONTO PARA COPIAR E COLAR

## 1. SETUP INICIAL

### 1.1 Criar projeto
```bash
npx create-next-app@latest prospection --typescript --tailwind --eslint

cd prospection

npm install \
  @supabase/supabase-js \
  axios \
  cheerio \
  puppeteer \
  lighthouse \
  node-fetch \
  dotenv

# Criar .env.local
touch .env.local
```

### 1.2 `.env.local` (template)
```
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima

# APIs externas
HUNTER_API_KEY=sua-chave-hunter
GOOGLE_MAPS_API_KEY=sua-chave-google
ANTHROPIC_API_KEY=sua-chave-anthropic

# Segurança
CRON_SECRET=seu-secret-aleatorio-40-caracteres

# Database (alternativa PostgreSQL local)
DATABASE_URL=postgresql://user:password@localhost:5432/prospection
```

---

## 2. ESTRUTURA DE PASTAS

```
prospection/
├── app/
│   ├── api/
│   │   ├── daily-prospection.ts      (Main Orchestrator)
│   │   ├── scrape-google-maps.ts
│   │   ├── analyze-site.ts
│   │   ├── find-email.ts
│   │   └── generate-message.ts
│   └── page.tsx                      (Dashboard)
├── lib/
│   ├── supabase.ts                   (Client)
│   ├── deduplication.ts
│   ├── types.ts                      (Interfaces)
│   └── constants.ts
├── components/
│   └── LeadTable.tsx
├── scripts/
│   └── test-prospection.js           (Para testar local)
└── .env.local
```

---

## 3. CÓDIGO PRONTO

### 3.1 `lib/types.ts`

```typescript
export interface Lead {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  email_confidence?: number;
  website?: string;
  category: string;
  source: string;
  lat?: number;
  lng?: number;
  created_at?: Date;
}

export interface SiteAnalysis {
  lead_id: string;
  has_site: boolean;
  is_wordpress: boolean;
  last_update?: Date;
  performance_score?: number;
  is_mobile?: boolean;
  technology: string[];
  design_age: 'modern' | 'old' | 'unknown';
  is_prospect: boolean;
  error?: string;
}

export interface Message {
  lead_id: string;
  message: string;
  category: string;
  created_at: Date;
}
```

### 3.2 `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function insertLeads(leads: any[]) {
  const { error } = await supabase
    .from('leads')
    .insert(leads);
  
  if (error) throw new Error(`Insert leads error: ${error.message}`);
  return true;
}

export async function insertAnalysis(analyses: any[]) {
  const { error } = await supabase
    .from('site_analysis')
    .insert(analyses);
  
  if (error) throw new Error(`Insert analysis error: ${error.message}`);
  return true;
}

export async function insertOutreach(messages: any[]) {
  const { error } = await supabase
    .from('outreach')
    .insert(messages);
  
  if (error) throw new Error(`Insert outreach error: ${error.message}`);
  return true;
}

export async function logExecution(log: any) {
  const { error } = await supabase
    .from('execution_logs')
    .insert([log]);
  
  if (error) console.error('Log error:', error);
}

export async function getProspects() {
  const { data, error } = await supabase
    .from('site_analysis')
    .select('leads(*), site_analysis(*)')
    .eq('is_prospect', true)
    .limit(100);
  
  if (error) throw error;
  return data;
}

export async function getLeads(limit = 50) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}
```

### 3.3 `lib/deduplication.ts`

```typescript
export function deduplicateLeads(leads: any[]) {
  const seen = new Map();
  const deduped = [];

  for (const lead of leads) {
    // Chave: nome + telefone + categoria
    const key = `${lead.name?.trim().toLowerCase()}|${lead.phone?.trim()}|${lead.category}`;
    
    if (!seen.has(key)) {
      seen.set(key, true);
      deduped.push(lead);
    }
  }

  return deduped;
}

export function deduplicateEmails(emails: string[]) {
  return Array.from(new Set(emails.map(e => e.toLowerCase())));
}
```

### 3.4 `api/scrape-google-maps.ts` (Versão Simplificada)

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Para MVP: usar busca manual no Google Maps e extrair dados
// Versão simplificada usando busca por categoria + location

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const leads = [];

    // Exemplo: Scraping de diretório público (legal)
    const categories = ['advogados', 'dentistas', 'farmácias'];
    const states = ['SP', 'RJ', 'MG'];

    for (const category of categories) {
      for (const state of states) {
        // Exemplo: usando API pública de dados.gov.br
        // Em produção, você usaria Google Maps API corretamente
        
        const mockLeads = generateMockLeads(category, state);
        leads.push(...mockLeads);
      }
    }

    return res.json({ 
      leads: leads.slice(0, 50),
      count: leads.length 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

function generateMockLeads(category: string, state: string) {
  // Para MVP, usar dados reais de diretório ou Google Maps
  const companies = {
    advogados: [
      { name: 'Silva & Associados', phone: '11999999999', website: 'https://silva.adv.br' },
      { name: 'Oliveira Jurídico', phone: '11988888888', website: 'https://oliveira-adv.com.br' }
    ],
    dentistas: [
      { name: 'Clínica DenteSaúde', phone: '11977777777', website: 'https://dentesaude.com.br' }
    ],
    farmácias: [
      { name: 'Farmácia Central', phone: '11966666666', website: 'https://farmacia-central.com.br' }
    ]
  };

  return (companies[category as keyof typeof companies] || []).map(lead => ({
    ...lead,
    category,
    state,
    source: 'google_maps',
    lat: -23.5505,
    lng: -46.6333
  }));
}
```

### 3.5 `api/analyze-site.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    const analysis = await analyzeSite(url);
    return res.json(analysis);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function analyzeSite(url: string) {
  try {
    // Verificar se site existe
    const response = await fetch(url, { 
      method: 'HEAD',
      timeout: 5000 
    }).catch(() => ({ status: 404 }));

    if (response.status === 404) {
      return {
        url,
        has_site: false,
        is_wordpress: false,
        is_prospect: true // Sem site = prospect!
      };
    }

    // Buscar HTML
    const htmlResponse = await fetch(url, { timeout: 5000 });
    const html = await htmlResponse.text();

    // Detectar WordPress
    const isWordPress = html.includes('wp-content') || 
                        html.includes('wp-includes') ||
                        html.includes('/wp-json') ||
                        html.includes('wordpress');

    // Detectar CMS
    const technology = detectTechnology(html);

    // Detectar design age (heurística simples)
    const designAge = detectDesignAge(html);

    // Verificar último update
    const lastUpdate = extractLastUpdate(html);

    // Critério de prospect
    const isProspect = isWordPress || 
                       designAge === 'old' || 
                       (lastUpdate && isOlderThanXDays(lastUpdate, 730));

    return {
      url,
      has_site: true,
      is_wordpress: isWordPress,
      technology,
      design_age: designAge,
      last_update: lastUpdate,
      is_prospect: isProspect,
      performance_score: 50 // Placeholder: implementar Lighthouse depois
    };
  } catch (error: any) {
    return {
      url,
      has_site: false,
      error: error.message,
      is_prospect: true // Erro = prospect (sem site)
    };
  }
}

function detectTechnology(html: string): string[] {
  const techs = [];
  
  if (html.includes('wp-content')) techs.push('WordPress');
  if (html.includes('wix.com')) techs.push('Wix');
  if (html.includes('shopify')) techs.push('Shopify');
  if (html.includes('webflow')) techs.push('Webflow');
  if (html.includes('joomla')) techs.push('Joomla');
  if (html.includes('drupal')) techs.push('Drupal');
  if (html.includes('squarespace')) techs.push('Squarespace');
  
  return techs.length > 0 ? techs : ['Unknown'];
}

function detectDesignAge(html: string): string {
  const modernIndicators = [
    'flexbox', 'grid', 'custom-properties', 'css-variable',
    'preload', 'aspect-ratio', 'loading=lazy'
  ];
  
  const oldIndicators = [
    'table-layout', 'text-align:center', '<table', 'width="100%"',
    'spacer.gif', '<font', 'flash', 'applet'
  ];
  
  const modernCount = modernIndicators.filter(i => 
    html.toLowerCase().includes(i)
  ).length;
  
  const oldCount = oldIndicators.filter(i => 
    html.toLowerCase().includes(i)
  ).length;
  
  if (oldCount > modernCount + 2) return 'old';
  if (modernCount > oldCount + 2) return 'modern';
  return 'unknown';
}

function extractLastUpdate(html: string): Date | null {
  // Procurar meta tags
  const metaMatch = html.match(/<meta[^>]*?(?:last-modified|updated|date)[^>]*?content="([^"]+)"/i);
  if (metaMatch) {
    const date = new Date(metaMatch[1]);
    if (!isNaN(date.getTime())) return date;
  }

  // Procurar copyright footer (ano)
  const copyrightMatch = html.match(/copyright\s*[&©]\s*(\d{4})/i);
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1]);
    if (year > 1990 && year < 2100) {
      return new Date(year, 11, 31);
    }
  }

  return null;
}

function isOlderThanXDays(date: Date, days: number): boolean {
  const diff = Date.now() - date.getTime();
  return diff > days * 24 * 60 * 60 * 1000;
}
```

### 3.6 `api/find-email.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { company_name, domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  try {
    // Tentar Hunter.io primeiro
    const hunterEmail = await findEmailHunter(company_name, domain);
    
    if (hunterEmail.email) {
      return res.json(hunterEmail);
    }

    // Fallback: gerar emails pattern + validar
    const guessedEmails = guessEmailPatterns(company_name, domain);
    
    return res.json({
      email: guessedEmails[0],
      emails: guessedEmails,
      confidence: 40,
      method: 'pattern_guess'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

async function findEmailHunter(
  companyName: string,
  domain: string
) {
  try {
    const response = await axios.get('https://api.hunter.io/v2/email-finder', {
      params: {
        domain,
        company: companyName,
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${process.env.HUNTER_API_KEY}`
      }
    });

    const data = response.data?.data;
    
    return {
      email: data?.email || null,
      confidence: data?.confidence || 0,
      position: data?.position || null
    };
  } catch (error) {
    console.error('Hunter error:', error);
    return { email: null, confidence: 0 };
  }
}

function guessEmailPatterns(companyName: string, domain: string): string[] {
  const firstName = companyName.split(' ')[0].toLowerCase();
  const companyShort = companyName.replace(/\s/g, '').toLowerCase();

  return [
    `contato@${domain}`,
    `info@${domain}`,
    `ola@${domain}`,
    `olá@${domain}`,
    `vendas@${domain}`,
    `comercial@${domain}`,
    `${firstName}@${domain}`,
    `${companyShort}@${domain}`
  ];
}

export async function enrichLeads(leads: any[]) {
  const enriched = [];

  for (const lead of leads) {
    if (!lead.website) {
      enriched.push({ ...lead, email: null, email_confidence: 0 });
      continue;
    }

    try {
      const domain = extractDomain(lead.website);
      const emailData = await findEmailHunter(lead.name, domain);

      enriched.push({
        ...lead,
        email: emailData.email,
        email_confidence: emailData.confidence
      });

      // Rate limit: 1 req/segundo (Hunter free = 100/mês)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error enriching ${lead.name}:`, error);
      enriched.push(lead);
    }
  }

  return enriched;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace('www.', '');
  } catch {
    return url.replace('www.', '').replace(/\//g, '');
  }
}
```

### 3.7 `api/generate-message.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const templates: Record<string, { pain: string; benefit: string }> = {
  'advogado': {
    pain: 'site desatualizado prejudica confiança de clientes',
    benefit: 'site profissional atrai mais leads jurídicos'
  },
  'dentista': {
    pain: 'pacientes querem agendar online',
    benefit: 'site com agendamento 24/7 aumenta pacientes'
  },
  'farmácia': {
    pain: 'pouca visibilidade frente às grandes redes',
    benefit: 'destaque no Google + e-commerce local'
  },
  'contador': {
    pain: 'CNPJ sem presença digital perde clientes',
    benefit: 'site moderno atrai MEIs e autônomos'
  },
  'veterinária': {
    pain: 'falta galeria de cases e depoimentos',
    benefit: 'portfólio visual melhora agendamentos'
  },
  'estética': {
    pain: 'Instagram perde seguidores, precisa site próprio',
    benefit: 'blog + e-commerce gera receita extra'
  },
  'tech': {
    pain: 'portfólio outdated não atrai clientes',
    benefit: 'portfólio interativo + blog técnico = credibilidade'
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { lead } = req.body;

  if (!lead) {
    return res.status(400).json({ error: 'Lead required' });
  }

  try {
    const message = await generateMessage(lead);
    return res.json({ message });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

async function generateMessage(lead: any): Promise<string> {
  const template = templates[lead.category] || templates['advogado'];

  const prompt = `Você é um vendedor consultivo de sites. Gere UM ÚNICA mensagem curta (máx 160 chars) para WhatsApp/email.

Contexto:
- Empresa: ${lead.name}
- Categoria: ${lead.category}
- Situação site: ${lead.site_analysis || 'site desatualizado ou sem site'}

Diretrizes:
1. Use nome da empresa
2. Cite O problema específico: "${template.pain}"
3. Sugira O benefício: "${template.benefit}"
4. Não venda, convide para conversa
5. Tom amigável e consultivo
6. Máx 160 caracteres

Exemplo para advogado:
"Oi ${lead.name}! Vi que seu site pode melhorar. Sites bem feitos trazem mais clientes pelo Google. Conversa rápida? 👋"

Agora gere para ${lead.category}:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Limpar se passou do limite
    if (text.length > 160) {
      return text.substring(0, 157) + '...';
    }
    
    return text;
  } catch (error) {
    console.error('Anthropic error:', error);
    return `Oi ${lead.name}! Seu site pode melhorar. Conversa rápida? 👋`;
  }
}
```

### 3.8 `api/daily-prospection.ts` (MAIN ORCHESTRATOR)

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { analyzeSite } from './analyze-site';
import { enrichLeads } from './find-email';
import { 
  insertLeads, 
  insertAnalysis, 
  insertOutreach,
  logExecution 
} from '@/lib/supabase';
import { deduplicateLeads } from '@/lib/deduplication';

// Importar função de scrape (você vai criar)
// import { scrapeGoogleMaps } from './scrape-google-maps';

const DEMO_LEADS = [
  {
    name: 'Silva & Associados',
    phone: '11999999999',
    website: 'https://silva-adv.com.br',
    category: 'advogado',
    source: 'google_maps'
  },
  {
    name: 'Clínica DenteSaúde',
    phone: '11988888888',
    website: 'https://dentesaude.com.br',
    category: 'dentista',
    source: 'google_maps'
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar CRON_SECRET para segurança
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const startTime = Date.now();
    console.log('🚀 Starting daily prospection...');

    // 1. SCRAPE (usar dados demo para MVP)
    let leads = [...DEMO_LEADS];
    console.log(`✓ Scraped: ${leads.length} leads`);

    // 2. DEDUPLICAÇÃO
    leads = deduplicateLeads(leads);
    console.log(`✓ Deduped: ${leads.length} leads`);

    // 3. ANALISAR SITES
    const analyzed = [];
    for (const lead of leads) {
      try {
        const analysis = await analyzeSite(lead.website);
        analyzed.push({
          lead_id: lead.id || `temp_${Date.now()}`,
          ...analysis
        });
      } catch (error) {
        console.error(`Error analyzing ${lead.website}:`, error);
        analyzed.push({
          lead_id: lead.id || `temp_${Date.now()}`,
          has_site: false,
          is_prospect: true
        });
      }
    }

    const prospects = analyzed.filter(a => a.is_prospect);
    console.log(`✓ Prospects found: ${prospects.length}`);

    // 4. ENRIQUECER COM EMAILS
    const enriched = await enrichLeads(prospects.map((p, i) => leads[i]));
    const withEmail = enriched.filter(e => e.email);
    console.log(`✓ Emails found: ${withEmail.length}`);

    // 5. GERAR MENSAGENS
    const messages = [];
    for (const lead of enriched) {
      try {
        const msgRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/generate-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead })
        });
        
        const { message } = await msgRes.json();
        
        messages.push({
          lead_id: lead.id || `temp_${Date.now()}`,
          message,
          category: lead.category,
          created_at: new Date()
        });
      } catch (error) {
        console.error(`Error generating message for ${lead.name}:`, error);
      }
    }
    console.log(`✓ Messages generated: ${messages.length}`);

    // 6. SALVAR EM BANCO (comentado para MVP, ativar quando tiver Supabase)
    // await insertLeads(enriched);
    // await insertAnalysis(analyzed);
    // await insertOutreach(messages);

    // 7. LOG
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✓ Completed in ${duration}s`);

    // Omitir log no banco para MVP local
    // await logExecution({
    //   status: 'success',
    //   leads_scraped: leads.length,
    //   leads_analyzed: analyzed.length,
    //   emails_found: withEmail.length,
    //   messages_generated: messages.length,
    //   created_at: new Date()
    // });

    return res.status(200).json({
      success: true,
      summary: {
        scraped: leads.length,
        prospects: prospects.length,
        emails: withEmail.length,
        messages: messages.length,
        duration_seconds: duration.toFixed(2)
      },
      data: {
        leads: enriched.slice(0, 5),
        messages: messages.slice(0, 5)
      }
    });
  } catch (error: any) {
    console.error('❌ Error:', error);

    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
```

### 3.9 `vercel.json` (Scheduler automático)

```json
{
  "crons": [
    {
      "path": "/api/daily-prospection",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### 3.10 `app/page.tsx` (Dashboard básico)

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);

  useEffect(() => {
    // Carregar último resultado
    const stored = localStorage.getItem('lastProspectionRun');
    if (stored) {
      setLastRun(JSON.parse(stored));
    }
  }, []);

  async function runProspection() {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-prospection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      
      if (res.ok) {
        setLeads(data.data?.leads || []);
        setLastRun(data);
        localStorage.setItem('lastProspectionRun', JSON.stringify(data));
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      alert(`Erro ao executar: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Sistema de Prospecção</h1>

      <div className="mb-6 p-4 bg-blue-50 rounded">
        <button
          onClick={runProspection}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Executando...' : 'Executar Prospecção'}
        </button>

        {lastRun && (
          <div className="mt-4 text-sm">
            <p>Última execução: {new Date().toLocaleString()}</p>
            <p>Leads: {lastRun.summary?.scraped}</p>
            <p>Prospects: {lastRun.summary?.prospects}</p>
            <p>Emails: {lastRun.summary?.emails}</p>
            <p>Mensagens: {lastRun.summary?.messages}</p>
          </div>
        )}
      </div>

      {leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Nome</th>
                <th className="border p-2">Telefone</th>
                <th className="border p-2">Email</th>
                <th className="border p-2">Categoria</th>
                <th className="border p-2">Website</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any, i) => (
                <tr key={i}>
                  <td className="border p-2">{lead.name}</td>
                  <td className="border p-2">{lead.phone}</td>
                  <td className="border p-2">{lead.email}</td>
                  <td className="border p-2">{lead.category}</td>
                  <td className="border p-2">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Link
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

---

## 4. TESTE LOCAL (sem scheduler)

### `scripts/test-prospection.js`

```javascript
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testProspection() {
  const BASE_URL = 'http://localhost:3000';
  const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

  console.log('🚀 Testing prospection system...\n');

  try {
    const res = await fetch(`${BASE_URL}/api/daily-prospection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    
    console.log('✓ Response:', data);
    console.log('\n✓ Test complete!');
  } catch (error) {
    console.error('✗ Error:', error);
  }
}

testProspection();
```

**Rodar:**
```bash
# Terminal 1: iniciar Next.js
npm run dev

# Terminal 2: rodar teste
CRON_SECRET=seu-secret node scripts/test-prospection.js
```

---

## 5. DEPLOY NO VERCEL

```bash
# 1. Fazer push pra GitHub
git add .
git commit -m "Initial commit: prospection system"
git push origin main

# 2. Conectar no Vercel
# Ir em vercel.com → New Project → GitHub → Selecionar repo

# 3. Adicionar variáveis de ambiente (Vercel Dashboard)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
HUNTER_API_KEY=...
GOOGLE_MAPS_API_KEY=...
ANTHROPIC_API_KEY=...
CRON_SECRET=seu-secret-aleatorio

# 4. Deploy automático
# Vercel faz deploy automático quando faz push

# 5. Testar cron
# Ir em Project Settings → Cron Jobs → ver próxima execução
```

---

## PRÓXIMOS PASSOS

1. **Hoje:** Setup NextJS + banco (Supabase)
2. **Amanhã:** Implementar scraper + análise site
3. **Dia 3:** Email finder + IA
4. **Dia 4:** Dashboard + export
5. **Dia 5:** Deploy + primeira execução automática

**Boa sorte! Você consegue!**
