"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Phone,
  RotateCw,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { LeadWithDetails } from "@/lib/leads";
import {
  DeleteLeadButton,
  EditableEmail,
  EditablePhone,
  IgnoreButton,
  PipelineStageSelect,
  SendToCRMButton,
} from "./LeadActions";

export interface LeadRow {
  lead: LeadWithDetails;
  score: number;
  isPriority: boolean;
  isLandline: boolean;
  waLink: string | null;
  showPipeline: boolean;
  pipelineStatus: string;
  problem: string;
}

const STATUS_BADGES: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  contacted: { label: "Enviado", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  responded: { label: "Respondeu", icon: MessageSquare, className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" },
  meeting_scheduled: { label: "Reunião marcada", icon: Calendar, className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400" },
  proposal_sent: { label: "Proposta enviada", icon: FileText, className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400" },
  closed_won: { label: "Fechado (ganho)", icon: Trophy, className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
  closed_lost: { label: "Fechado (perdido)", icon: XCircle, className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  ignored: { label: "Ignorado", icon: Ban, className: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  unsubscribed: { label: "Descadastrado", icon: Ban, className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
  bounced: { label: "Email inválido", icon: AlertTriangle, className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function StatusBadge({ lead }: { lead: LeadWithDetails }) {
  const badge = lead.outreach_status ? STATUS_BADGES[lead.outreach_status] : null;
  if (badge) {
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    );
  }
  if (lead.email) {
    const Icon = STATUS_BADGES.pending.icon;
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES.pending.className}`}>
        <Icon className="h-3 w-3" />
        Pendente
      </span>
    );
  }
  return <span className="text-zinc-400 dark:text-zinc-600">-</span>;
}

function SiteSummary({ lead }: { lead: LeadWithDetails }) {
  if (lead.website && lead.social_platform) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
        só {lead.social_platform}
      </span>
    );
  }
  if (!lead.website) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-600 dark:text-amber-400">
        <XCircle className="h-3.5 w-3.5" />
        sem site
      </span>
    );
  }
  if (lead.is_broken) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" />
        com problema
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
      <Globe className="h-3.5 w-3.5 text-zinc-400" />
      tem site
      {lead.performance_score !== null && <span className="text-zinc-400">· nota {lead.performance_score}</span>}
    </span>
  );
}

function scoreClass(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="min-w-0 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

const chip = "rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

function LeadDetails({ row }: { row: LeadRow }) {
  const { lead } = row;
  const events: { icon: LucideIcon; label: string; date: string | null; className: string }[] = [
    { icon: CheckCircle2, label: "E-mail enviado", date: lead.contacted_at, className: "text-emerald-600 dark:text-emerald-400" },
    { icon: RotateCw, label: "Follow-up", date: lead.follow_up_sent_at, className: "text-blue-600 dark:text-blue-400" },
    { icon: Eye, label: "Abriu", date: lead.opened_at, className: "text-amber-600 dark:text-amber-400" },
    { icon: MousePointerClick, label: "Clicou", date: lead.clicked_at, className: "text-pink-600 dark:text-pink-400" },
    { icon: MessageCircle, label: "WhatsApp enviado", date: lead.whatsapp_template_sent_at, className: "text-green-600 dark:text-green-400" },
  ].filter((e) => e.date);

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard title="Contato">
          <Field label="Telefone" icon={Phone}>
            <span className="flex flex-wrap items-center gap-2">
              <EditablePhone leadId={lead.id} phone={lead.phone} />
              {row.isLandline && (
                <span
                  title="Formato de telefone fixo - pode ou não ter WhatsApp"
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                >
                  fixo?
                </span>
              )}
            </span>
          </Field>
          <Field label="E-mail" icon={Mail}>
            <EditableEmail leadId={lead.id} email={lead.email} />
          </Field>
          {lead.address && (
            <Field label="Endereço" icon={MapPin}>
              <span className="leading-relaxed text-zinc-600 dark:text-zinc-400">{lead.address}</span>
            </Field>
          )}
          {(row.waLink || lead.google_maps_url) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {row.waLink && (
                <a
                  href={row.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Abrir WhatsApp
                </a>
              )}
              {lead.google_maps_url && (
                <a
                  href={lead.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              )}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Site">
          <Field label="Endereço do site" icon={Globe}>
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              >
                <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\?.*$/, "")}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Não tem site</span>
            )}
          </Field>
          {lead.website && lead.social_platform && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Não é site próprio: só um link de {lead.social_platform}.
            </p>
          )}
          {lead.website && !lead.social_platform && (
            <Field label="Análise" icon={Flame}>
              <div className="flex flex-wrap gap-1.5">
                {lead.performance_score !== null && <span className={chip}>nota {lead.performance_score}/100</span>}
                {lead.is_wordpress && <span className={chip}>WordPress</span>}
                {lead.is_outdated && <span className={chip}>visual antigo</span>}
                {lead.is_slow && <span className={chip}>lento</span>}
                {lead.performance_score === null && !lead.is_wordpress && !lead.is_outdated && !lead.is_slow && (
                  <span className="text-zinc-400">sem achados</span>
                )}
              </div>
              {lead.is_broken && lead.broken_reason && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{lead.broken_reason}</p>
              )}
            </Field>
          )}
          {lead.website && !lead.social_platform && (
            <div>
              <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Frase usada na mensagem</p>
              <blockquote className="rounded-lg border-l-2 border-emerald-500 bg-zinc-50 px-3 py-2 text-sm italic leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                “{row.problem}”
              </blockquote>
            </div>
          )}
        </DetailCard>

        <DetailCard title="Funil">
          <Field label="Histórico" icon={Clock}>
            {events.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {events.map(({ icon: Icon, label, date, className }) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center gap-1.5 ${className}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                    <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">{formatDate(date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-zinc-400">Nenhum contato feito ainda.</span>
            )}
          </Field>
          {row.showPipeline && (
            <Field label="Etapa do funil" icon={FileText}>
              <PipelineStageSelect leadId={lead.id} currentStatus={row.pipelineStatus} />
            </Field>
          )}
        </DetailCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <SendToCRMButton leadId={lead.id} synced={!!lead.crm_synced_at} />
        <span className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {lead.outreach_status !== "ignored" && (
            <span className="inline-flex items-center gap-1">
              Ignorar <IgnoreButton leadId={lead.id} />
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            Excluir <DeleteLeadButton leadId={lead.id} name={lead.name} />
          </span>
        </span>
      </div>
    </div>
  );
}

const COLUMN_COUNT = 5;

export function LeadsTableBody({ rows }: { rows: LeadRow[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <tbody>
      {rows.map((row) => {
        const { lead } = row;
        const open = openIds.has(lead.id);
        return (
          <Fragment key={lead.id}>
            <tr
              onClick={(e) => {
                // Clique em link/botao/campo dentro da linha nao abre/fecha.
                if ((e.target as HTMLElement).closest("a, button, input, select")) return;
                toggle(lead.id);
              }}
              className={`cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60 ${
                open ? "bg-zinc-50 dark:bg-zinc-900/60" : row.isPriority ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
              }`}
            >
              <td className="whitespace-nowrap py-3 pl-3 pr-2">
                <span className="inline-flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreClass(row.score)}`}>
                    <Flame className="h-3 w-3" />
                    {row.score}
                  </span>
                </span>
              </td>
              <td className="max-w-0 px-4 py-3">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50" title={lead.name}>
                  {lead.name}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{lead.category}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  {lead.phone ?? <span className="text-zinc-400">-</span>}
                  {row.waLink && (
                    <a
                      href={row.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir WhatsApp"
                      className="inline-flex items-center rounded-full bg-emerald-100 p-1 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                  )}
                </span>
              </td>
              <td className="px-4 py-3">
                <SiteSummary lead={lead} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <StatusBadge lead={lead} />
                  {lead.opened_at && <Eye className="h-3.5 w-3.5 text-amber-500" aria-label="Abriu" />}
                  {lead.clicked_at && <MousePointerClick className="h-3.5 w-3.5 text-pink-500" aria-label="Clicou" />}
                </span>
              </td>
            </tr>
            {open && (
              <tr className="bg-zinc-50 dark:bg-zinc-900/60">
                <td colSpan={COLUMN_COUNT} className="border-t border-dashed border-zinc-200 p-0 dark:border-zinc-800">
                  <LeadDetails row={row} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </tbody>
  );
}
