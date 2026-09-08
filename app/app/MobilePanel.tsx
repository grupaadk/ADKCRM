"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { KanbanItem } from "@/convex/kanban";
import { useStatuses } from "@/components/StatusLabelsContext";
import { deriveStatusStyle } from "@/lib/statuses";
import { uColor, uInitials } from "@/lib/userColor";
import {
  Search,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  ArchiveRestore,
  MapPin,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Filter,
  FilePlus,
  SlidersHorizontal,
} from "lucide-react";
import NewOrderModal from "@/app/admin/klient/[id]/NewOrderModal";
import NewOpportunityModal from "@/components/NewOpportunityModal";

/* ─────────── stałe / typy ─────────── */

type DocState = "gray" | "red" | "green";

const DOC_KEYS = [
  "pomiar",
  "umowa",
  "gwarancja_alco",
  "odbior_inwestor",
  "protokol_montaz",
  "faktura",
  "reklamacja",
] as const;

const DOC_NAMES: Record<string, string> = {
  pomiar: "Pomiar",
  umowa: "Umowa",
  gwarancja_alco: "Gwarancja ALCO",
  odbior_inwestor: "Odbiór inwestor",
  protokol_montaz: "Protokół montażu",
  faktura: "Faktura",
  reklamacja: "Reklamacja",
};

const DOC_COLORS: Record<DocState, string> = {
  gray: "#cbd5e1",
  red: "#ef4444",
  green: "#22c55e",
};

const SERVICE_COLORS = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#ffedd5", text: "#c2410c" },
  { bg: "#f0fdf4", text: "#166534" },
];

function daysInStatus(statusChangedAt?: number) {
  if (!statusChangedAt) return null;
  const days = Math.floor((Date.now() - statusChangedAt) / (1000 * 60 * 60 * 24));
  let color: "slate" | "amber" | "red" = "slate";
  if (days >= 7) color = "red";
  else if (days >= 3) color = "amber";
  return { days, label: `${days}d`, color };
}

/* ─────────── Komponenty pomocnicze ─────────── */

function ServiceBadges({ services }: { services: string[] }) {
  if (!services || services.length === 0) return null;
  const MAX = 2;
  const shown = services.slice(0, MAX);
  const rest = services.length - MAX;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {shown.map((s, i) => {
        const c = SERVICE_COLORS[i % SERVICE_COLORS.length];
        return (
          <span
            key={s}
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: c.bg, color: c.text }}
          >
            {s}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          +{rest}
        </span>
      )}
    </div>
  );
}

function DocSquares({ docs }: { docs: Record<string, DocState> }) {
  if (!docs) return null;
  return (
    <div className="flex items-center gap-1 mt-2">
      {DOC_KEYS.map((key) => {
        const st = docs[key] ?? "gray";
        return (
          <div
            key={key}
            title={`${DOC_NAMES[key]}: ${st}`}
            className="size-2.5 rounded-xs shrink-0 transition-colors"
            style={{ backgroundColor: DOC_COLORS[st as DocState] }}
          />
        );
      })}
    </div>
  );
}

/* ─────────── Karta Zlecenia / Szansy ─────────── */

function MobileKanbanCard({
  item,
  expanded,
  onToggleExpand,
  onArchive,
}: {
  item: KanbanItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onArchive?: (item: KanbanItem) => void;
}) {
  const router = useRouter();
  const statuses = useStatuses();
  const changeStatus = useMutation(api.orders.changeStatus);
  const updatePendingStage = useMutation(api.jotformInternal.updatePendingStage);
  const convertToOrder = useMutation(api.salesOpportunities.convertToOrder);

  const isPending = item.type === "pending";
  const fullName =
    item.clientType === "business" && item.companyName
      ? item.companyName
      : `${item.clientFirstName} ${item.clientLastName}`.trim();
  const titleText = isPending ? "Szansa sprzedaży" : item.orderName ?? "Zlecenie";

  const daysInfo = daysInStatus(item.statusChangedAt);

  const assignees = item.assignees ?? (item.assignedUserId ? [{ id: item.assignedUserId, name: null, color: item.assignedUserColor }] : []);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) {
      router.push(`/app/szansa/${item.pendingId}?from=panel`);
    } else {
      router.push(`/app/zlecenie/${item.orderId}?from=panel`);
    }
  };

  const currentStatusDef = useMemo(() => {
    if (isPending) return null;
    return statuses.find((s) => s.key === item.status);
  }, [statuses, item.status, isPending]);

  const statusStyle = useMemo(() => {
    return currentStatusDef ? deriveStatusStyle(currentStatusDef.color) : null;
  }, [currentStatusDef]);

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl p-3.5 border border-gray-200/90 shadow-xs relative transition-all active:scale-[0.99] hover:border-[#4abbc3]"
    >
      {/* Nagłówek karty */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-900 truncate">{titleText}</span>
            {item.customText && (
              <span className="inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/50 truncate max-w-[140px]">
                {item.customText}
              </span>
            )}
            {isPending ? (
              <span className="inline-block rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200/50">
                Szansa
              </span>
            ) : (
              statusStyle && currentStatusDef && (
                <span
                  className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold border shrink-0"
                  style={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    borderColor: statusStyle.border,
                  }}
                >
                  {currentStatusDef.label}
                </span>
              )
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium truncate">{fullName || "—"}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {daysInfo && (
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                daysInfo.color === "red"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : daysInfo.color === "amber"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {daysInfo.label}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {/* Miasto / Adres */}
      {(item.investmentCity || item.investmentStreet || item.clientCity) && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 font-medium truncate">
          <MapPin className="size-3 shrink-0 text-slate-400" />
          <span className="truncate">
            {[item.investmentStreet, item.investmentCity || item.clientCity].filter(Boolean).join(", ")}
          </span>
        </div>
      )}

      {/* Usługi & Kwota */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <ServiceBadges services={item.services} />
        {item.type === "order" && item.grossAmount !== undefined && (
          <span className="text-xs font-bold text-slate-800 shrink-0">
            {item.grossAmount.toLocaleString("pl-PL")} zł
          </span>
        )}
      </div>

      {/* Kwadraty dokumentów */}
      {item.type === "order" && item.docs && <DocSquares docs={item.docs} />}

      {/* Przypisani użytkownicy */}
      {assignees.length > 0 && (
        <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-medium text-slate-400">Przypisani:</span>
          <div className="flex items-center -space-x-1">
            {assignees.map((u) => (
              <span
                key={u.id}
                title={u.name ?? ""}
                className="flex size-4.5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white"
                style={{ background: u.color ?? uColor(u.id) }}
              >
                {uInitials(u.name ?? "U")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rozwinięcie szczegółów */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs"
        >
          {item.comment && (
            <p className="text-slate-600 bg-slate-50 rounded-xl p-2.5 text-[11px]">
              <span className="font-bold block text-slate-700 mb-0.5">Komentarz:</span>
              {item.comment}
            </p>
          )}

          {/* Akcje / Zmiana statusu */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {isPending ? (
              <>
                {item.status === "lead" && (
                  <button
                    type="button"
                    onClick={() => updatePendingStage({ opportunityId: item.pendingId, stage: "inquiry" })}
                    className="flex-1 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 border border-blue-200 active:scale-95 transition-all text-center"
                  >
                    Oznacz: Oferta wysłana
                  </button>
                )}
                {item.status === "inquiry" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await convertToOrder({ opportunityId: item.pendingId });
                        router.push(`/admin/klient/${res.clientId}/zlecenie/${res.orderId}`);
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "Błąd konwersji");
                      }
                    }}
                    className="flex-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs active:scale-95 transition-all text-center"
                  >
                    Utwórz Zlecenie
                  </button>
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(item)}
                    className="rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 border border-amber-200 active:scale-95 transition-all"
                  >
                    Archiwizuj
                  </button>
                )}
              </>
            ) : (
              <div className="w-full space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase">
                  Zmień status zlecenia:
                </label>
                <select
                  value={item.status}
                  onChange={(e) => changeStatus({ orderId: item.orderId, newStatus: e.target.value as any })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4abbc3]"
                >
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleCardClick}
              className="w-full flex items-center justify-center gap-1 rounded-xl bg-slate-900 text-white py-1.5 text-[11px] font-bold active:scale-98 transition-all"
            >
              Szczegóły <ExternalLink className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Główny Komponent MobilePanel ─────────── */

export default function MobilePanel() {
  const router = useRouter();
  const statuses = useStatuses();

  const [activeTab, setActiveTab] = useState<"kanban" | "opportunities" | "archived">("kanban");
  const [selectedStatusIndex, setSelectedStatusIndex] = useState(0);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string | "all">("all");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string | "all">("all");
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNewOppModal, setShowNewOppModal] = useState(false);

  const items = useQuery(api.kanban.list);
  const archivedOrders = useQuery(api.kanban.listArchived);
  const archivedOpps = useQuery(api.salesOpportunities.listArchivedOpportunities);
  const users = useQuery(api.users.listAllActive);
  const servicesList = useQuery(api.services.listActive) ?? [];

  const archiveOpp = useMutation(api.salesOpportunities.archiveOpportunity);
  const unarchiveOpp = useMutation(api.salesOpportunities.unarchiveOpportunity);

  const loading = items === undefined;

  /* Listy statusów zlecenia */
  const activeStatuses = useMemo(
    () => statuses.filter((s) => s.key !== "archived" && s.key !== "lead" && s.key !== "inquiry" && s.kind !== "opportunity"),
    [statuses]
  );
  const validStatusIndex = Math.min(selectedStatusIndex, Math.max(0, activeStatuses.length - 1));
  const currentStatus = activeStatuses[validStatusIndex] ?? activeStatuses[0];

  /* Swiping kolumn */
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && validStatusIndex < activeStatuses.length - 1) setSelectedStatusIndex(validStatusIndex + 1);
      if (dx > 0 && validStatusIndex > 0) setSelectedStatusIndex(validStatusIndex - 1);
    },
    [validStatusIndex, activeStatuses.length],
  );

  /* Filtrowanie elementów */
  const filteredItems = useMemo(() => {
    const all = items ?? [];
    const q = searchQuery.trim().toLowerCase();

    return all.filter((item) => {
      // Filtr usera
      if (selectedUserFilter !== "all") {
        const uids = item.assignees?.map((a) => a.id) ?? [];
        if (item.assignedUserId && !uids.includes(item.assignedUserId)) {
          uids.push(item.assignedUserId);
        }
        if (!uids.includes(selectedUserFilter as Id<"users">)) return false;
      }

      // Filtr usługi
      if (selectedServiceFilter !== "all") {
        if (!item.services?.includes(selectedServiceFilter)) return false;
      }

      // Szukajka
      if (q) {
        const fullName = `${item.clientFirstName} ${item.clientLastName} ${item.companyName ?? ""}`.toLowerCase();
        const customText = (item.customText ?? "").toLowerCase();
        const city = (item.investmentCity ?? item.clientCity ?? "").toLowerCase();
        const street = (item.investmentStreet ?? "").toLowerCase();
        const comment = (item.comment ?? "").toLowerCase();
        const name = (item.type === "order" ? item.orderName ?? "" : "").toLowerCase();

        return (
          fullName.includes(q) ||
          customText.includes(q) ||
          city.includes(q) ||
          street.includes(q) ||
          comment.includes(q) ||
          name.includes(q)
        );
      }

      return true;
    });
  }, [items, searchQuery, selectedUserFilter, selectedServiceFilter]);

  /* Podział na Kanban (zlecenia/szanse w statusach) i Szanse */
  const kanbanItemsByStatus = useMemo(() => {
    const map: Record<string, KanbanItem[]> = {};
    for (const s of activeStatuses) map[s.key] = [];

    for (const item of filteredItems) {
      if (item.type === "order") {
        if (map[item.status]) map[item.status].push(item);
      }
    }
    return map;
  }, [filteredItems, activeStatuses]);

  const filteredOrders = useMemo(() => {
    return filteredItems.filter((i) => i.type === "order");
  }, [filteredItems]);

  const salesOpportunities = useMemo(() => {
    return filteredItems.filter((i) => i.type === "pending");
  }, [filteredItems]);

  const filteredArchivedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return archivedOrders ?? [];
    return (archivedOrders ?? []).filter((o) => {
      const fullName = `${o.clientFirstName ?? ""} ${o.clientLastName ?? ""} ${o.companyName ?? ""}`.toLowerCase();
      const name = (o.name ?? "").toLowerCase();
      const city = (o.investmentCity ?? o.clientCity ?? "").toLowerCase();
      const street = (o.investmentStreet ?? "").toLowerCase();
      return fullName.includes(q) || name.includes(q) || city.includes(q) || street.includes(q);
    });
  }, [archivedOrders, searchQuery]);

  const filteredArchivedOpps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return archivedOpps ?? [];
    return (archivedOpps ?? []).filter((opp) => {
      const fullName = `${opp.firstName ?? ""} ${opp.lastName ?? ""}`.toLowerCase();
      const email = (opp.email ?? "").toLowerCase();
      const phone = (opp.phone ?? "").toLowerCase();
      return fullName.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [archivedOpps, searchQuery]);

  const toggleExpandCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleArchiveOpp = async (item: KanbanItem) => {
    if (item.type === "pending") {
      await archiveOpp({ opportunityId: item.pendingId });
    }
  };

  const hasActiveFilters = selectedUserFilter !== "all" || selectedServiceFilter !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="size-6 text-[#4abbc3] animate-spin" />
      </div>
    );
  }

  const currentColumnItems = currentStatus ? kanbanItemsByStatus[currentStatus.key] ?? [] : [];

  return (
    <div className="space-y-3 min-h-0 relative">
      {/* ── Top Bar Container ── */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200/80 shadow-xs space-y-2.5">
        {/* Row 1: Sub-tabs & Action Icons */}
        <div className="flex items-center justify-between gap-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("kanban")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === "kanban" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Zlecenia
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("opportunities")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === "opportunities" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Szanse
              {salesOpportunities.length > 0 && (
                <span className="size-3.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-extrabold flex items-center justify-center">
                  {salesOpportunities.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archived")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === "archived" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Archiwum
            </button>
          </div>

          {/* Action icons (Search, Filter, Add) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              className={`p-2 rounded-xl text-xs font-bold transition ${
                showSearch || searchQuery ? "bg-[#4abbc3]/15 text-[#2c8a90]" : "bg-slate-50 border border-gray-200 text-slate-600"
              }`}
              title="Szukaj"
            >
              <Search className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowFilterPicker(true)}
              className={`p-2 rounded-xl text-xs font-bold relative transition ${
                hasActiveFilters ? "bg-[#4abbc3] text-white shadow-xs" : "bg-slate-50 border border-gray-200 text-slate-600"
              }`}
              title="Filtruj"
            >
              <SlidersHorizontal className="size-4" />
              {hasActiveFilters && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu((prev) => !prev)}
                className="p-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs active:scale-95 transition"
                title="Dodaj"
              >
                <Plus className="size-4" />
              </button>

              {/* Popover menu do dodawania */}
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute right-0 top-11 z-40 bg-white rounded-2xl shadow-xl border border-gray-200 p-1.5 w-44 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMenu(false);
                        setShowNewOrderModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2"
                    >
                      <Plus className="size-3.5 text-[#4abbc3]" />
                      <span>Nowe Zlecenie</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMenu(false);
                        setShowNewOppModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-xs font-bold text-purple-700 flex items-center gap-2"
                    >
                      <Sparkles className="size-3.5 text-purple-600" />
                      <span>Nowa Szansa</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Search input bar */}
        {(showSearch || searchQuery) && (
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj zlecenia, klienta, miasta..."
              className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#4abbc3]"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Row 3: Status Column Strip */}
        {activeTab === "kanban" && (
          <div className="pt-0.5 border-t border-gray-100">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5">
              {activeStatuses.map((s, idx) => {
                const count = (kanbanItemsByStatus[s.key] ?? []).length;
                const isActive = idx === validStatusIndex;
                const color = s.color ?? "#4abbc3";

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedStatusIndex(idx)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
                      isActive ? "text-white shadow-xs" : "bg-slate-100 border border-gray-200/60 text-slate-600"
                    }`}
                    style={isActive ? { background: color } : undefined}
                  >
                    <span>{s.label}</span>
                    <span
                      className={`size-4 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                        isActive ? "bg-white/30 text-white" : "bg-white text-slate-700 border border-gray-200/50"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Content View ── */}
      <div className="space-y-3 pb-8">
        {/* Tab 1: Kanban (Zlecenia) */}
        {activeTab === "kanban" && (
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="space-y-3 min-h-[50vh]">
            {searchQuery.trim().length > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-0.5">
                  <span>Wyniki wyszukiwania ({filteredOrders.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Wszystkie statusy</span>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-1">
                    <p className="text-xs font-bold text-slate-700">Brak zleceń pasujących do wyszukiwania</p>
                    <p className="text-[11px] text-slate-400">Spróbuj wpisać inną frazę lub wyczyścić filtry.</p>
                  </div>
                ) : (
                  filteredOrders.map((item) => (
                    <MobileKanbanCard
                      key={item.id}
                      item={item}
                      expanded={expandedCardIds.has(item.id)}
                      onToggleExpand={() => toggleExpandCard(item.id)}
                      onArchive={handleArchiveOpp}
                    />
                  ))
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-0.5">
                  <span>{currentStatus?.label} ({currentColumnItems.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Przesuń palcem aby zmienić status</span>
                </div>

                {currentColumnItems.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-1">
                    <p className="text-xs font-bold text-slate-700">Brak zleceń w tym statusie</p>
                    <p className="text-[11px] text-slate-400">Przełącz status powyżej lub dodaj nowe zlecenie.</p>
                  </div>
                ) : (
                  currentColumnItems.map((item) => (
                    <MobileKanbanCard
                      key={item.id}
                      item={item}
                      expanded={expandedCardIds.has(item.id)}
                      onToggleExpand={() => toggleExpandCard(item.id)}
                      onArchive={handleArchiveOpp}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Szanse Sprzedaży (Leads) */}
        {activeTab === "opportunities" && (
          <div className="space-y-3 min-h-[50vh]">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-0.5">
              <span>Aktywne Szanse Sprzedaży ({salesOpportunities.length})</span>
            </div>

            {salesOpportunities.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">Brak aktywnych szans sprzedaży</p>
                <p className="text-[11px] text-slate-400">Kliknij przycisk (+) powyżej, aby dodać nową.</p>
              </div>
            ) : (
              salesOpportunities.map((item) => (
                <MobileKanbanCard
                  key={item.id}
                  item={item}
                  expanded={expandedCardIds.has(item.id)}
                  onToggleExpand={() => toggleExpandCard(item.id)}
                  onArchive={handleArchiveOpp}
                />
              ))
            )}
          </div>
        )}

        {/* Tab 3: Archiwum */}
        {activeTab === "archived" && (
          <div className="space-y-4 min-h-[50vh]">
            {/* Sekcja Archiwalnych Zleceń */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Zarchiwizowane Zlecenia ({filteredArchivedOrders.length})
              </h3>
              {filteredArchivedOrders.length === 0 ? (
                <p className="text-xs text-slate-400 bg-white p-4 rounded-xl border border-gray-200 text-center">
                  Brak zarchiwizowanych zleceń
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredArchivedOrders.map((o) => (
                    <div
                      key={o._id}
                      onClick={() => router.push(`/app/zlecenie/${o._id}?from=panel`)}
                      className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-between gap-2 active:bg-slate-50 transition cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{o.name ?? "Zlecenie"}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {o.clientType === "business" && o.companyName ? o.companyName : `${o.clientFirstName} ${o.clientLastName}`}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sekcja Archiwalnych Szans */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Zarchiwizowane Szanse ({filteredArchivedOpps.length})
              </h3>
              {filteredArchivedOpps.length === 0 ? (
                <p className="text-xs text-slate-400 bg-white p-4 rounded-xl border border-gray-200 text-center">
                  Brak zarchiwizowanych szans
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredArchivedOpps.map((opp) => (
                    <div
                      key={opp._id}
                      className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{opp.firstName} {opp.lastName}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{opp.email || opp.phone || "—"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => unarchiveOpp({ opportunityId: opp._id })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                      >
                        <ArchiveRestore className="size-3.5" /> Przywróć
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet Filtrów ── */}
      {showFilterPicker && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowFilterPicker(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-bottom duration-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">Filtry Panelu</span>
              <button
                type="button"
                onClick={() => setShowFilterPicker(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Filtr Osoby */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Przypisana osoba:
                </label>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="all">Wszyscy użytkownicy</option>
                  {(users ?? []).map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.displayName ?? u.login ?? "Użytkownik"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtr Usługi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Usługa:
                </label>
                <select
                  value={selectedServiceFilter}
                  onChange={(e) => setSelectedServiceFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="all">Wszystkie usługi</option>
                  {servicesList.map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserFilter("all");
                    setSelectedServiceFilter("all");
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Wyczyść
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterPicker(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Zastosuj
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modale tworzenia ── */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => setShowNewOrderModal(false)}
        />
      )}

      {showNewOppModal && (
        <NewOpportunityModal
          onClose={() => setShowNewOppModal(false)}
          onSuccess={() => setShowNewOppModal(false)}
        />
      )}
    </div>
  );
}
