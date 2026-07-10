import {
  Flame,
  LayoutDashboard,
  Pencil,
  Gauge,
  Settings,
  Activity,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/whatsapp-queue", icon: MessageCircle, label: "Fila de WhatsApp" },
  { href: "/template", icon: Pencil, label: "Template" },
  { href: "/usage", icon: Gauge, label: "Uso e cotas" },
  { href: "/settings", icon: Settings, label: "Configurações" },
  { href: "/status", icon: Activity, label: "Status" },
];

export function PageHeader({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Flame className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            GarimpoLeads
          </h1>
        </a>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === active;
            return (
              <a
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
