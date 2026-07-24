import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

// Busca as meta tags Open Graph da pagina, igual o preview que o WhatsApp
// mostra antes de mandar um link. Timeout curto e falha silenciosa (devolve
// tudo null) - isso e so um enfeite visual, nao pode travar o envio da
// mensagem se o site de destino for lento ou nao tiver OG tags.
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "'url' é obrigatório" }, { status: 400 });
  }

  try {
    const { data: html } = await axios.get<string>(url, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GarimpoLeadsBot/1.0)" },
      maxContentLength: 2_000_000,
    });

    const $ = cheerio.load(html);
    const meta = (property: string) =>
      $(`meta[property="${property}"]`).attr("content") ??
      $(`meta[name="${property}"]`).attr("content") ??
      null;

    const preview: LinkPreview = {
      url,
      title: meta("og:title") ?? $("title").first().text() ?? null,
      description: meta("og:description") ?? meta("description"),
      image: meta("og:image"),
      siteName: meta("og:site_name"),
    };

    return NextResponse.json(preview);
  } catch {
    return NextResponse.json({ url, title: null, description: null, image: null, siteName: null });
  }
}
