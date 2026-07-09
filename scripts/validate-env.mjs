// Roda antes de cada build (local ou na Vercel) pra pegar env vars mal
// configuradas ANTES do deploy, em vez de descobrir só quando algo falha
// silenciosamente em produção. Motivado por uma sessão real de debug onde
// 4 variáveis diferentes vieram com um "=" colado no início do valor.

import { existsSync } from "fs";
import dotenv from "dotenv";

if (existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

const errors = [];

function check(name, { required = true, validate } = {}) {
  const value = process.env[name];

  if (!value) {
    if (required) errors.push(`${name}: variável não definida`);
    return;
  }

  if (value.startsWith("=")) {
    errors.push(
      `${name}: começa com "=" — provavelmente colou "NOME=valor" inteiro no campo Value em vez de só o valor`
    );
    return;
  }

  if (value !== value.trim()) {
    errors.push(`${name}: tem espaço/quebra de linha sobrando no início ou fim`);
    return;
  }

  if (validate) {
    const problem = validate(value);
    if (problem) errors.push(`${name}: ${problem}`);
  }
}

check("SUPABASE_URL", {
  validate: (v) => (!v.startsWith("https://") ? "deveria começar com https://" : null),
});
check("SUPABASE_ANON_KEY");
check("SUPABASE_SERVICE_ROLE_KEY");
check("HUNTER_API_KEY");
check("GOOGLE_MAPS_API_KEY", {
  validate: (v) => (!v.startsWith("AIza") ? "chaves do Google costumam começar com 'AIza'" : null),
});
check("CRON_SECRET", {
  validate: (v) => (!/^[a-f0-9]{32,}$/i.test(v) ? "esperado um hex de 32+ caracteres" : null),
});
check("RESEND_API_KEY", {
  validate: (v) => (!v.startsWith("re_") ? "chaves do Resend começam com 're_'" : null),
});
check("EMAIL_FROM_ADDRESS", {
  validate: (v) => (!v.includes("@") ? "não parece um email válido" : null),
});
check("EMAIL_FROM_NAME");
check("DASHBOARD_PASSWORD");
check("APP_URL", {
  validate: (v) => (!v.startsWith("http") ? "deveria começar com http:// ou https://" : null),
});
check("RESEND_WEBHOOK_SECRET", {
  validate: (v) => (!v.startsWith("whsec_") ? "segredos de webhook do Resend começam com 'whsec_'" : null),
});
check("TELEGRAM_BOT_TOKEN", {
  validate: (v) => (!/^\d+:[\w-]+$/.test(v) ? "formato esperado: dígitos:token (ex: 123456:AAG...)" : null),
});
check("TELEGRAM_CHAT_ID", {
  validate: (v) => (!/^-?\d+$/.test(v) ? "deveria ser só números (com - opcional na frente)" : null),
});
check("GESTAODEVZ_USER_UID", {
  validate: (v) => (!/^[a-zA-Z0-9]{20,40}$/.test(v) ? "formato inesperado de UID do Firebase" : null),
});
check("FIREBASE_SERVICE_ACCOUNT_JSON", {
  validate: (v) => {
    try {
      const parsed = JSON.parse(v);
      if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
        return "JSON válido mas faltam campos (project_id/private_key/client_email)";
      }
      return null;
    } catch {
      return "não é um JSON válido";
    }
  },
});
check("SEND_DAILY_LIMIT", {
  required: false,
  validate: (v) => (Number.isNaN(Number(v)) ? "deveria ser um número" : null),
});

if (errors.length > 0) {
  console.error("\n❌ Variáveis de ambiente com problema:\n");
  for (const err of errors) console.error(`  - ${err}`);
  console.error(
    "\nCorrija no .env.local (ou nas Environment Variables da Vercel) antes de continuar.\n"
  );
  process.exit(1);
}

console.log("✅ Variáveis de ambiente OK.");
