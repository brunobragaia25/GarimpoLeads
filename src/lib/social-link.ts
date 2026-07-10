// O Google Maps deixa o dono do negócio preencher "site" com qualquer URL,
// e é comum aparecer o link do Instagram/Facebook/WhatsApp/Linktree ali em
// vez de um site de verdade. Detecta isso só pelo domínio (sem precisar
// buscar o conteúdo), pra já vir marcado na lista em vez do usuário
// descobrir clicando um por um.
export type SocialPlatform = "instagram" | "facebook" | "whatsapp" | "linktree" | "outro link";

const PLATFORM_PATTERNS: Array<{ platform: SocialPlatform; hosts: string[] }> = [
  { platform: "instagram", hosts: ["instagram.com"] },
  { platform: "facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { platform: "whatsapp", hosts: ["wa.me", "api.whatsapp.com", "whatsapp.com"] },
  { platform: "linktree", hosts: ["linktr.ee"] },
  {
    platform: "outro link",
    hosts: ["linkin.bio", "beacons.ai", "bio.link", "allmylinks.com", "carrd.co"],
  },
];

export function detectSocialPlatform(website: string | null | undefined): SocialPlatform | null {
  if (!website) return null;

  let hostname: string;
  try {
    hostname = new URL(website.startsWith("http") ? website : `https://${website}`)
      .hostname.replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }

  for (const { platform, hosts } of PLATFORM_PATTERNS) {
    if (hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return platform;
    }
  }

  return null;
}
