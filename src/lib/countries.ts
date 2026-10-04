// Tudo que muda de um pais pro outro fica aqui - adicionar um pais novo e
// basicamente adicionar uma entrada nesse objeto (mais o texto padrao dos
// templates em template.ts).

export type Country = "BR" | "US" | "PT" | "UK" | "BRUS";

// Idioma das frases geradas pelo sistema (achado do site, rodape, pagina de
// descadastro). pt-PT e separado do pt-BR porque o texto brasileiro ("pra",
// "tá") soa estranho em Portugal.
export type Locale = "pt-BR" | "pt-PT" | "en";

export interface CountryConfig {
  code: Country;
  name: string;
  shortName: string;
  flag: string;
  locale: Locale;
  // Idioma da busca no Google Places e o conector da query ("dentistas em Lisboa").
  placesLanguage: string;
  searchJoin: string;
  // DDI pro link do WhatsApp; e se o numero local vem com o 0 de tronco
  // (UK: "020 7946 0958" -> +44 20 7946 0958).
  ddi: string;
  stripTrunkZero: boolean;
  // Minimo e maximo de digitos de um telefone no formato local (sem DDI).
  // O maximo decide se o numero ja veio com DDI: so conta como "tem DDI"
  // se for mais longo que um numero local (senao o DDD 55 do RS parecia o
  // DDI 55 do Brasil).
  minPhoneDigits: number;
  maxLocalDigits: number;
  // Fila de WhatsApp so aceita numero com cara de celular de verdade. No
  // Brasil fica false: muita empresa registra o WhatsApp Business num
  // numero de formato fixo (VoIP/PABX virtual), entao filtrar por "parece
  // celular" perderia leads bons. Em Portugal e Reino Unido a maioria dos
  // telefones do Google Maps e fixo mesmo (sem WhatsApp nenhum) - sem esse
  // filtro a fila ficava cheia de numero que nunca abre.
  whatsappMobileOnly: boolean;
  // Chaves em message_templates.category dos textos especiais do pais.
  templateKeys: {
    default: string | null; // null = template padrao global (category null)
    noSite: string;
    followUp: string;
  };
}

export const COUNTRIES: Record<Country, CountryConfig> = {
  BR: {
    code: "BR",
    name: "Brasil",
    shortName: "BR",
    flag: "🇧🇷",
    locale: "pt-BR",
    placesLanguage: "pt-BR",
    searchJoin: "em",
    ddi: "55",
    stripTrunkZero: false,
    minPhoneDigits: 10,
    maxLocalDigits: 11,
    whatsappMobileOnly: false,
    templateKeys: { default: null, noSite: "__whatsapp_no_site__", followUp: "__followup__" },
  },
  US: {
    code: "US",
    name: "EUA",
    shortName: "EUA",
    flag: "🇺🇸",
    locale: "en",
    placesLanguage: "en",
    searchJoin: "in",
    ddi: "1",
    stripTrunkZero: false,
    minPhoneDigits: 10,
    maxLocalDigits: 10,
    whatsappMobileOnly: false,
    templateKeys: { default: "__default_us__", noSite: "__no_site_us__", followUp: "__followup_us__" },
  },
  PT: {
    code: "PT",
    name: "Portugal",
    shortName: "PT",
    flag: "🇵🇹",
    locale: "pt-PT",
    placesLanguage: "pt-PT",
    searchJoin: "em",
    ddi: "351",
    stripTrunkZero: false,
    minPhoneDigits: 9,
    maxLocalDigits: 9,
    whatsappMobileOnly: true,
    templateKeys: { default: "__default_pt__", noSite: "__no_site_pt__", followUp: "__followup_pt__" },
  },
  UK: {
    code: "UK",
    name: "Reino Unido",
    shortName: "UK",
    flag: "🇬🇧",
    locale: "en",
    placesLanguage: "en-GB",
    searchJoin: "in",
    ddi: "44",
    stripTrunkZero: true,
    minPhoneDigits: 10,
    maxLocalDigits: 11,
    whatsappMobileOnly: true,
    templateKeys: { default: "__default_uk__", noSite: "__no_site_uk__", followUp: "__followup_uk__" },
  },
  // Negocio de brasileiro imigrante nos EUA (restaurante, mercado, corretor
  // de imoveis etc). Geograficamente nos EUA (endereco/telefone no formato
  // americano), mas quem atende costuma falar portugues e manter o habito
  // de usar WhatsApp mesmo morando fora - os dois problemas do "US" normal
  // (ninguem responde e-mail, ninguem usa WhatsApp) não se aplicam aqui.
  BRUS: {
    code: "BRUS",
    name: "Brasileiros nos EUA",
    shortName: "BR-EUA",
    flag: "🇧🇷🇺🇸",
    locale: "pt-BR",
    // "en" pro endereco voltar em formato americano (extractCity ja sabe
    // ler "Street, City, ST ZIP") - so o texto da mensagem e que e em
    // portugues, a busca no Google Places e os dados do lugar ficam em ingles.
    placesLanguage: "en",
    searchJoin: "em",
    ddi: "1",
    stripTrunkZero: false,
    minPhoneDigits: 10,
    maxLocalDigits: 10,
    // Numero americano nao da pra saber se e celular ou fixo pelo formato
    // (igual ao US normal) - sem filtro, tenta WhatsApp em qualquer um.
    whatsappMobileOnly: false,
    templateKeys: { default: "__default_brus__", noSite: "__no_site_brus__", followUp: "__followup_brus__" },
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRIES) as Country[];

export function isCountry(value: unknown): value is Country {
  return typeof value === "string" && (COUNTRY_CODES as string[]).includes(value);
}

export function parseCountry(value: unknown): Country {
  return isCountry(value) ? value : "BR";
}

// Chave do template de uma categoria. Portugal e Reino Unido usam as
// mesmas palavras de categoria que Brasil/EUA ("dentistas", "dentists"),
// entao ganham prefixo pra nao herdar o texto de outro pais. BR e EUA
// continuam sem prefixo (templates que ja existem no banco).
export function categoryTemplateKey(category: string, country: Country): string {
  return country === "BR" || country === "US" ? category : `${country}:${category}`;
}
