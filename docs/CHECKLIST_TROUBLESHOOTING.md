# CHECKLIST DE IMPLEMENTAÇÃO + TROUBLESHOOTING

## FASE 1 - SETUP INICIAL (Dia 1)

### [ ] Ambiente
- [ ] Node.js 18+ instalado (`node -v`)
- [ ] npm 9+ instalado (`npm -v`)
- [ ] Git configurado
- [ ] Editor de código (VS Code)
- [ ] Conta Vercel (vercel.com)

### [ ] Criar projeto
```bash
npx create-next-app@latest prospection --typescript --tailwind
cd prospection
npm install @supabase/supabase-js axios cheerio puppeteer lighthouse node-fetch dotenv
```

### [ ] Setup Supabase
- [ ] Criar conta em supabase.com
- [ ] Criar novo projeto (selecionar região)
- [ ] Esperar ~2 minutos para estar pronto
- [ ] Ir em Settings → Database → Connection String
- [ ] Copiar URL (sem password, copiar do formulário do Supabase)
- [ ] Copiar ANON_KEY (encontrar em Settings → API)
- [ ] Preencher `.env.local`

### [ ] Verificar credenciais
```bash
# Testar Supabase
curl https://seu-projeto.supabase.co/rest/v1/leads?limit=1 \
  -H "apikey: sua-chave-anonima"
# Deve retornar JSON (pode estar vazio)
```

### [ ] Setup APIs
- [ ] Hunter.io: criar conta (free.hunter.io), copiar API key
- [ ] Google Maps: criar projeto no Google Cloud, ativar Places API, criar API key
- [ ] Anthropic: criar conta, gerar API key

### [ ] Criar `.env.local`
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave
HUNTER_API_KEY=sua-chave
GOOGLE_MAPS_API_KEY=sua-chave
ANTHROPIC_API_KEY=sua-chave
CRON_SECRET=seu-secret-aleatorio-40-chars-min
DATABASE_URL=opcional-postgresql
```

### [ ] Estrutura de pastas
```bash
mkdir -p app/api lib components scripts
touch vercel.json
```

---

## FASE 2 - BANCO DE DADOS (Dia 2)

### [ ] Criar schema Supabase
1. Ir em Supabase Dashboard → SQL Editor
2. Colar script SQL (ver PLANO_TECNICO.md seção 7.1)
3. Executar todas as queries

### [ ] Verificar tabelas
```sql
-- Executar no Supabase SQL Editor
SELECT * FROM leads LIMIT 1;
SELECT * FROM site_analysis LIMIT 1;
SELECT * FROM outreach LIMIT 1;
SELECT * FROM execution_logs LIMIT 1;
```

### [ ] Testes de insert
```sql
-- Supabase → Query → SQL
INSERT INTO leads (name, phone, email, website, category, source)
VALUES ('Teste Corp', '11999999999', 'teste@teste.com', 'https://teste.com', 'advogado', 'test');

SELECT * FROM leads WHERE name = 'Teste Corp';
DELETE FROM leads WHERE name = 'Teste Corp';
```

---

## FASE 3 - API ROUTES (Dias 3-4)

### [ ] Copiar código boilerplate
- [ ] `lib/types.ts` (tipos)
- [ ] `lib/supabase.ts` (cliente Supabase)
- [ ] `lib/deduplication.ts` (dedup leads)
- [ ] `api/analyze-site.ts` (análise site)
- [ ] `api/find-email.ts` (buscar emails)
- [ ] `api/generate-message.ts` (IA)
- [ ] `api/daily-prospection.ts` (orchestrador)

### [ ] Testar cada API route
```bash
# Terminal 1: rodar dev
npm run dev

# Terminal 2: testar analyze-site
curl -X POST http://localhost:3000/api/analyze-site \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com"}'

# Deve retornar JSON com análise
```

### [ ] Testar generate-message
```bash
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d '{
    "lead": {
      "name": "Silva Advocacia",
      "category": "advogado",
      "website": "https://silva-adv.com.br"
    }
  }'
```

### [ ] Testar daily-prospection (sem Supabase ainda)
```bash
curl -X POST http://localhost:3000/api/daily-prospection \
  -H "Authorization: Bearer seu-secret-aleatorio-40-chars" \
  -H "Content-Type: application/json"
```

**Esperado:** Retorna JSON com `success: true` e summary

---

## FASE 4 - FRONTEND + DASHBOARD (Dia 5)

### [ ] Criar dashboard
- [ ] Copiar `app/page.tsx` do boilerplate
- [ ] Testar acesso em localhost:3000

### [ ] Testar execução manual
1. Abrir http://localhost:3000
2. Clicar botão "Executar Prospecção"
3. Aguardar resultado
4. Verificar tabela de leads

---

## FASE 5 - DEPLOY (Dia 6)

### [ ] Preparar GitHub
```bash
# Criar .gitignore
echo "node_modules/
.env.local
.next/
dist/
build/" > .gitignore

# Fazer commit
git add .
git commit -m "Initial: prospection system"
git branch -M main
git remote add origin https://github.com/seu-user/prospection.git
git push -u origin main
```

### [ ] Deploy Vercel
1. Ir em vercel.com/dashboard
2. Clicar "New Project"
3. Selecionar repo GitHub
4. Preencher Environment Variables (SUPABASE_URL, HUNTER_API_KEY, etc)
5. Clicar Deploy
6. Aguardar ~2 minutos

### [ ] Verificar deploy
- [ ] Acessar https://prospection-seu-user.vercel.app
- [ ] Testar botão "Executar Prospecção"
- [ ] Verificar logs: Vercel Dashboard → Deployments → Functions

### [ ] Verificar Cron (scheduler)
```bash
# Adicionar vercel.json
cat > vercel.json << 'EOF'
{
  "crons": [
    {
      "path": "/api/daily-prospection",
      "schedule": "0 8 * * *"
    }
  ]
}
EOF

git add vercel.json
git commit -m "Add cron scheduler"
git push
```

Vercel deve detectar automaticamente e agendar.

---

## TROUBLESHOOTING

### ❌ "Cannot find module @supabase/supabase-js"
**Solução:**
```bash
npm install @supabase/supabase-js
npm install
```

### ❌ "SUPABASE_URL is undefined"
**Solução:**
- Verificar `.env.local` tem SUPABASE_URL=...
- Não precisa aspas
- Salvar arquivo
- Reiniciar `npm run dev`

### ❌ "403 - Hunter API Key invalid"
**Solução:**
- Ir em https://hunter.io/dashboard/api
- Copiar API key correta (não é o login)
- Verificar se tem saldo (free = 100/mês)
- Testar curl direto:
```bash
curl https://api.hunter.io/v2/email-finder?domain=google.com&company=Google \
  -H "Authorization: Bearer SUA_CHAVE"
```

### ❌ "timeout at analyzeSite"
**Solução:**
- Site pode estar offline ou muito lento
- Aumentar timeout em `analyze-site.ts`:
```typescript
await page.goto(url, { 
  waitUntil: 'networkidle2',
  timeout: 10000  // aumentar para 10 segundos
});
```

### ❌ "Puppeteer: Chrome not found"
**Solução:**
```bash
npm install puppeteer-extra-plugin-stealth
# Ou rodar em Vercel (já tem Chrome) → não aparece localmente
```

### ❌ "Hunter returns 401 Unauthorized"
**Solução:**
- Verificar se API key está correta
- Verificar se não passou limite (100 grátis/mês)
- Testar em console:
```javascript
const apiKey = process.env.HUNTER_API_KEY;
console.log('Key:', apiKey); // Não deve ser undefined
```

### ❌ "Supabase insert retorna error: relation 'leads' does not exist"
**Solução:**
- Não criou as tabelas no Supabase
- Ir em SQL Editor do Supabase
- Copiar script completo do PLANO_TECNICO.md seção 7.1
- Executar cada CREATE TABLE

### ❌ "TypeError: Cannot read property 'email' of undefined"
**Solução:**
- API Hunter não retornou dado esperado
- Verificar resposta:
```typescript
console.log('Hunter response:', response.data); // debug
```

### ❌ "Cron não executou no Vercel"
**Solução:**
- Verificar se `vercel.json` está correto
- Fazer novo push (Vercel precisa fazer redeploy)
- Verificar timezone (usar UTC)
- Ir em Vercel Dashboard → Project Settings → Cron Jobs
- Deve listar `/api/daily-prospection` com próxima execução

### ❌ "GitHub Actions permission denied"
**Solução:**
- Se usar GitHub Actions (alternativa), adicionar secrets:
  - GitHub → Settings → Secrets and variables → Actions → New repository secret
  - Adicionar: DATABASE_URL, HUNTER_API_KEY, etc

---

## PERFORMANCE TIPS

### Taxa de requisições
- Hunter.io: free = 100/mês (1 req/segundo)
- Google Maps: free = 28k/mês
- Anthropic: cobrança por token (~1000 msgs = $10)

### Melhorar velocidade
```typescript
// Executar análises em paralelo (não sequencial)
const analyses = await Promise.all(
  leads.map(lead => analyzeSite(lead.website))
);
```

### Salvar em cache
```typescript
// Não re-analisar site se já analisou antes
const cachedAnalysis = await supabase
  .from('site_analysis')
  .select('*')
  .eq('lead_id', lead.id)
  .single();

if (cachedAnalysis.data) {
  return cachedAnalysis.data; // usar cache
}
```

---

## EXPANSION CHECKLIST

### MVP Done? Adicione:

### [ ] Scraper expandido
- [ ] 3+ categorias
- [ ] 5+ estados
- [ ] Múltiplas fontes (Google Maps + directories)

### [ ] Melhor site analysis
- [ ] Integrar Lighthouse real
- [ ] Detectar mais CMSes
- [ ] Análise de performance real

### [ ] Email finder avançado
- [ ] Apollo.io como fallback
- [ ] Validação SMTP
- [ ] Múltiplos emails por empresa

### [ ] Dashboard avançado
- [ ] Filtros por categoria/estado
- [ ] Gráficos (leads/dia, conversão)
- [ ] Export CSV/Excel
- [ ] Paginação

### [ ] Envio automático
- [ ] WhatsApp API (Twilio)
- [ ] Email (SendGrid)
- [ ] Agendar envios

### [ ] Rastreamento
- [ ] Reações (aceitou/rejeitou)
- [ ] Respostas automáticas
- [ ] Lead scoring

---

## TESTING

### Testar tudo localmente antes de deploy

```bash
# 1. Verificar tipos
npm run build

# 2. Verificar análise de código
npm run lint

# 3. Testar APIs manualmente (veja curl commands acima)

# 4. Testar scheduler (disparar manualmente)
curl -X POST http://localhost:3000/api/daily-prospection \
  -H "Authorization: Bearer seu-secret"

# 5. Verificar banco de dados
# Ir em Supabase → verificar se leads foram inseridos
```

### Deploy de teste
1. Fazer push pra branch test
2. Deploy no Vercel funciona automático
3. Testar em https://prospection-seu-user.vercel.app
4. Se OK, fazer push pra main

---

## SUPORTE RÁPIDO

### Logs
- **Local:** Console do terminal (`npm run dev`)
- **Vercel:** Vercel Dashboard → Deployments → Logs
- **Database:** Supabase → SQL Editor (SELECT * FROM execution_logs)

### Debug
```typescript
// Adicionar logs
console.log('DEBUG:', variavel);
console.error('ERROR:', erro);

// Em produção, ver em Vercel
// Em dev, ver no terminal
```

### Resetar tudo
```bash
# Limpar banco (cuidado!)
# Supabase → SQL Editor → TRUNCATE leads, site_analysis, outreach;

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

---

## ARQUIVO FINAL

Se tudo funcionar:
- [ ] Leads sendo scraped
- [ ] Sites sendo analisados
- [ ] Emails sendo encontrados
- [ ] Mensagens sendo geradas
- [ ] Dashboard mostrando dados
- [ ] Scheduler executando diariamente

**Parabéns! Sistema está pronto!**

Próximo passo: enviar mensagens automaticamente (Fase 3).
