"use client";

import { useMemo, useState } from "react";
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
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Pobieraj dane dopiero gdy panel otwarty.
  const ordersData = useQuery(api.orders.listForPicker, open ? {} : "skip");
  const orders = useMemo(() => ordersData ?? [], [ordersData]);
  const users = (useQuery(api.users.listAssignable, open ? {} : "skip") ?? []) as AssignUser[];
  const create = useMutation(api.dashboardTasks.adminCreate);

  const [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState<Id<"orders"> | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | null>(null);
  const [status, setStatus] = useState<StatusKey>("todo");
  const [assignOpen, setAssignOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedOrder = orders.find((o) => o._id === orderId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders.slice(0, 30);
    return orders
      .filter((o) =>
        [o.clientName, o.name ?? "", o.customText ?? ""].some((f) => f.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [orders, search]);

  function reset() {
    setSearch("");
    setOrderId(null);
    setTitle("");
    setDue("");
    setAssigneeId(null);
    setStatus("todo");
    setAssignOpen(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!orderId || !title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await create({
        orderId,
        title: title.trim(),
        status,
        dueDate: due ? new Date(due).getTime() : undefined,
        assignedUserId: assigneeId ?? undefined,
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
          disabled={!orderId || !title.trim() || submitting}
          className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {submitting ? "Dodawanie…" : "Dodaj zadanie"}
        </button>
      }
    >
      <div className="space-y-5 px-5 py-4">
        {/* wybór zlecenia */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Zlecenie *
          </label>
          {selectedOrder ? (
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
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj po kliencie, nazwie, tekście własnym…"
                  className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-1 py-3 text-xs text-gray-400">Brak zleceń.</div>
                )}
                {filtered.map((o) => (
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
          )}
        </div>

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
