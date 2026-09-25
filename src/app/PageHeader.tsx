import {
  Flame,
  LayoutDashboard,
  Pencil,
  Gauge,
  Settings,
  Activity,
  MessageCircle,
  Mail,
  Eye,
  Bot,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { CountrySwitcher } from "./CountrySwitcher";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/whatsapp-queue", icon: MessageCircle, label: "Fila de WhatsApp" },
  { href: "/email-queue", icon: Mail, label: "Fila de Email" },
  { href: "/conversion", icon: TrendingUp, label: "Conversão" },
  { href: "/whatsapp-chats", icon: Bot, label: "Chats de WhatsApp" },
  { href: "/preview", icon: Eye, label: "Prévia do envio" },
  { href: "/template", icon: Pencil, label: "Template" },
  { href: "/usage", icon: Gauge, label: "Uso e cotas" },
  { href: "/settings", icon: Settings, label: "Configurações" },
  { href: "/status", icon: Activity, label: "Status" },
];

// Barra lateral fixa no desktop (lg+) e barra no topo no celular. O espaco
// da lateral e reservado no <body> via data-app-sidebar (globals.css), pra
// nao precisar mexer no layout de cada pagina.
export function PageHeader({ active }: { active: string }) {
  return (
    <aside
      data-app-sidebar
      className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-4 lg:px-4 lg:py-5">
        <a href="/" className="flex items-center gap-2 lg:px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Flame className="h-4.5 w-4.5" />
          </div>
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">GarimpoLeads</span>
        </a>
        <CountrySwitcher />
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-4">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === active;
          return (
            <a
              key={href}
              href={href}
              className={`inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
