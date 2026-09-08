"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uColor, uInitials } from "@/lib/userColor";
import SideDrawer from "@/components/SideDrawer";
import { Search, Check, X, UserPlus, ChevronDown } from "lucide-react";

const STATUSES = [
  { key: "todo" as const, label: "Do zrobienia", accent: "#64748b", bg: "#f8fafc" },
  { key: "in_progress" as const, label: "W trakcie", accent: "#2563eb", bg: "#eff6ff" },
  { key: "done" as const, label: "Gotowe", accent: "#16a34a", bg: "#f0fdf4" },
];
type StatusKey = (typeof STATUSES)[number]["key"];

type AssignUser = { _id: Id<"users">; displayName?: string | null; login?: string | null; color?: string };

export default function AddTaskDrawer({
  open,
  onClose,
  initialTargetType = "order",
  initialColumnId = null,
}: {
  open: boolean;
  onClose: () => void;
  initialTargetType?: "order" | "opportunity" | "general";
  // Kolumna Kanbana, z której otwarto panel — nowe zadanie ląduje w tej kolumnie.
  initialColumnId?: string | null;
}) {
  const [targetType, setTargetType] = useState<"order" | "opportunity" | "general">(initialTargetType);

  const me = useQuery(api.users.me);



  // Pobieraj dane dopiero gdy panel otwarty (i tylko właściwą listę).
  const ordersData = useQuery(
    api.orders.listForPicker,
    open && targetType === "order" ? {} : "skip",
  );
  const orders = useMemo(() => ordersData ?? [], [ordersData]);
  const oppsData = useQuery(
    api.salesOpportunities.listForPicker,
    open && targetType === "opportunity" ? {} : "skip",
  );
  const opps = useMemo(() => oppsData ?? [], [oppsData]);
  const users = (useQuery(api.users.listAssignable, open ? {} : "skip") ?? []) as AssignUser[];
  const create = useMutation(api.dashboardTasks.adminCreate);

  const [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState<Id<"orders"> | null>(null);
  const [opportunityId, setOpportunityId] = useState<Id<"pendingJotformSubmissions"> | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | null>(null);
  const [status, setStatus] = useState<StatusKey>("todo");
  const [assignOpen, setAssignOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetType(initialTargetType);
      if (me && assigneeId === null) {
        setAssigneeId(me._id);
      }
    }
  }, [open, initialTargetType, me, assigneeId]);

  const selectedOrder = orders.find((o) => o._id === orderId) ?? null;
  const selectedOpp = opps.find((o) => o._id === opportunityId) ?? null;

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders.slice(0, 30);
    return orders
      .filter((o) =>
        [o.clientName, o.name ?? "", o.customText ?? ""].some((f) => f.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [orders, search]);

  const filteredOpps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return opps.slice(0, 30);
    return opps
      .filter((o) => [o.clientName, o.customText ?? ""].some((f) => f.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [opps, search]);

  const hasTarget = targetType === "order" ? !!orderId : !!opportunityId;

  function reset() {
    setSearch("");
    setOrderId(null);
    setOpportunityId(null);
    setTitle("");
    setDue("");
    setAssigneeId(me?._id ?? null);
    setStatus("todo");
    setAssignOpen(false);
  }

  function switchType(next: "order" | "opportunity" | "general") {
    setTargetType(next);
    setSearch("");
    setOrderId(null);
    setOpportunityId(null);
  }

  function close() {
    reset();
    setTargetType("order");
    onClose();
  }

  async function submit() {
    if ((!hasTarget && targetType !== "general") || !title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await create({
        orderId: targetType === "order" ? (orderId ?? undefined) : undefined,
        opportunityId: targetType === "opportunity" ? (opportunityId ?? undefined) : undefined,
        title: title.trim(),
        status,
        dueDate: due ? new Date(due).getTime() : undefined,
        assignedUserId: assigneeId ?? undefined,
        columnId: initialColumnId ? (initialColumnId as Id<"taskColumns">) : undefined,
      });
      close();
    } finally {
      setSubmitting(false);
    }
  }

  const assignee = users.find((u) => u._id === assigneeId) ?? null;

  return (
    <SideDrawer
      open={open}
      onClose={close}
      title="Nowe zadanie"
      width={480}
      footer={
        <button
          onClick={submit}
          disabled={(!hasTarget && targetType !== "general") || !title.trim() || submitting}
          className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {submitting ? "Dodawanie…" : "Dodaj zadanie"}
        </button>
      }
    >
      <div className="space-y-5 px-5 py-4">
        {/* przełącznik typu celu */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Przypisz do *
          </label>
          <div className="flex gap-1.5">
            {([
              { key: "order" as const, label: "Zlecenie" },
              { key: "opportunity" as const, label: "Szansa sprzedaży" },
              { key: "general" as const, label: "Zadanie" },
            ]).map((t) => {
              const active = targetType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => switchType(t.key)}
                  className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { borderColor: "#2563eb", background: "#eff6ff", color: "#2563eb" }
                      : { borderColor: "#e5e7eb", background: "#fff", color: "#6b7280" }
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* wybór celu */}
        {targetType !== "general" && (
        <div>
          {targetType === "order" ? (
            selectedOrder ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {selectedOrder.name ?? "Zlecenie"}
                  </div>
                  <div className="truncate text-xs text-gray-500">{selectedOrder.clientName}</div>
                </div>
                <button
                  onClick={() => setOrderId(null)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  title="Zmień zlecenie"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Szukaj po kliencie, nazwie, tekście własnym…"
                    className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-gray-400"
                  />
                </div>
                <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                  {filteredOrders.length === 0 && (
                    <div className="px-1 py-3 text-xs text-gray-400">Brak zleceń.</div>
                  )}
                  {filteredOrders.map((o) => (
                    <button
                      key={o._id}
                      onClick={() => setOrderId(o._id)}
                      className="flex w-full flex-col items-start rounded-md border border-gray-100 px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-gray-900">
                          {o.name ?? "Zlecenie"}
                        </span>
                        {o.customText && <span className="chip-custom shrink-0">{o.customText}</span>}
                      </span>
                      <span className="truncate text-xs text-gray-500">{o.clientName}</span>
                    </button>
                  ))}
                </div>
              </>
            )
          ) : selectedOpp ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">Szansa sprzedaży</div>
                <div className="truncate text-xs text-gray-500">{selectedOpp.clientName}</div>
              </div>
              <button
                onClick={() => setOpportunityId(null)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                title="Zmień szansę"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj po kliencie, tekście własnym…"
                  className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {filteredOpps.length === 0 && (
                  <div className="px-1 py-3 text-xs text-gray-400">Brak szans sprzedaży.</div>
                )}
                {filteredOpps.map((o) => (
                  <button
                    key={o._id}
                    onClick={() => setOpportunityId(o._id)}
                    className="flex w-full flex-col items-start rounded-md border border-gray-100 px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-gray-900">
                        {o.clientName}
                      </span>
                      {o.customText && <span className="chip-custom shrink-0">{o.customText}</span>}
                    </span>
                    <span className="truncate text-xs text-gray-500">
                      {o.stage === "inquiry" ? "Oferta wysłana" : "Lead"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {/* tytuł */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Treść zadania *
          </label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
            placeholder="Co trzeba zrobić?"
            className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </div>

        {/* status */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Status
          </label>
          <div className="flex gap-1.5">
            {STATUSES.map((s) => {
              const active = status === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { borderColor: s.accent, background: s.bg, color: s.accent }
                      : { borderColor: "#e5e7eb", background: "#fff", color: "#6b7280" }
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* termin + osoba */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Termin
            </label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-gray-400"
            />
          </div>
          <div className="relative">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Przypisz osobę
            </label>
            <button
              onClick={() => setAssignOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {assignee ? (
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: assignee.color ?? uColor(assignee._id) }}
                >
                  {uInitials(assignee.displayName ?? assignee.login ?? "")}
                </span>
              ) : (
                <UserPlus className="size-4 shrink-0 text-gray-400" />
              )}
              <span className="flex-1 truncate text-left">
                {assignee ? (assignee.displayName ?? assignee.login) : "Nieprzypisane"}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
            </button>
            {assignOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setAssigneeId(null); setAssignOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-gray-300">
                    <X className="size-3 text-gray-400" />
                  </span>
                  Nie przypisano
                </button>
                {users.map((u) => {
                  const name = u.displayName ?? u.login ?? "";
                  const sel = assigneeId === u._id;
                  return (
                    <button
                      key={u._id}
                      onClick={() => { setAssigneeId(u._id); setAssignOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <span
                        className="flex size-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                        style={{ background: u.color ?? uColor(u._id) }}
                      >
                        {uInitials(name)}
                      </span>
                      <span className="flex-1 truncate text-left">{name}</span>
                      {sel && <Check className="size-3.5 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}
