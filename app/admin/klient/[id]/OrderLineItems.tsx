"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const VAT_RATES = [0, 8, 23];
const UNITS = ["szt.", "m²", "mb", "usł.", "kpl.", "godz."];

const PRODUCT_TYPES_23 = [
  "Stolarka okienna",
  "Stolarka drzwiowa",
  "Brama garażowa",
  "Zabudowa tarasu",
  "Konstrukcje aluminiowe",
  "Ogrodzenie",
  "System przeciwsłoneczny",
];

const PRODUCT_TYPES_8 = [
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (brama garażowa z montażem) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (drzwi zewnętrzne z montażem) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (przygotowanie mebli do montażu) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (zabudowa tarasu z montażem) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (zadaszenie z montażem) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (stolarka budowlana z montażem) PKWiU 43.32.10.0.",
  "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (stolarka okienna z montażem) PKWiU 43.32.10.0.",
];

const VAT_NAMES: Record<number, string[]> = {
  23: PRODUCT_TYPES_23,
  8: PRODUCT_TYPES_8,
};

type NameChip = { label: string; value: string };

const NAME_CHIPS: Record<number, NameChip[]> = {
  23: PRODUCT_TYPES_23.map((t) => ({ label: t, value: t })),
  8: PRODUCT_TYPES_8.map((t) => {
    const match = t.match(/\(([^)]+)\)/);
    return { label: match ? match[1] : t, value: t };
  }),
};

function NameSelector({
  value,
  onChange,
  vatRate,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  vatRate: number;
  disabled?: boolean;
  id?: string;
}) {
  const chips = NAME_CHIPS[vatRate] ?? [];

  return (
    <div className="space-y-2">
      <input
        id={id}
        type="text"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={chips.length > 0 ? "Wybierz poniżej lub wpisz..." : "Wpisz nazwę..."}
      />
      {chips.length > 0 && !disabled && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const selected = value === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChange(selected ? "" : chip.value)}
                title={chip.value}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selected
                    ? "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type LineItem = {
  _id: Id<"orderLineItems">;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  discountPercent?: number;
  serviceId?: Id<"servicePricing">;
};

type EditState = Partial<Omit<LineItem, "_id" | "serviceId">>;

function itemNet(item: LineItem) {
  const disc = item.discountPercent ?? 0;
  return item.quantity * item.unitPrice * (1 - disc / 100);
}

function itemGross(item: LineItem) {
  return itemNet(item) * (1 + item.vatRate / 100);
}

function LineItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: LineItem;
  onSave: (id: Id<"orderLineItems">, data: EditState) => Promise<void>;
  onDelete: (id: Id<"orderLineItems">) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditState>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function startEdit() {
    setDraft({
      name: item.name,
      description: item.description ?? "",
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      discountPercent: item.discountPercent ?? 0,
    });
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(item._id, draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    setConfirmDelete(false);
    try {
      await onDelete(item._id);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-3 py-2" colSpan={7}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa</label>
                <NameSelector
                  value={draft.name ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                  vatRate={draft.vatRate ?? item.vatRate}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis (opcjonalnie)</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ilość</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.quantity ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Jedn.</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={draft.unit ?? "szt."}
                  onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cena netto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.unitPrice ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, unitPrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">VAT %</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={draft.vatRate ?? 23}
                  onChange={(e) => setDraft((d) => ({ ...d, vatRate: parseInt(e.target.value) }))}
                >
                  {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rabat %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.discountPercent ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, discountPercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy || !draft.name}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Zapisz
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-2.5 text-sm font-medium text-slate-800">
        {item.name}
        {item.description && (
          <span className="ml-1.5 text-xs text-slate-400">{item.description}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-700">{fmt(item.quantity)} {item.unit}</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-700">{fmt(item.unitPrice)} zł</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-500">
        {(item.discountPercent ?? 0) > 0 ? `-${item.discountPercent}%` : "—"}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-500">{item.vatRate}%</td>
      <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-800">
        {fmt(itemGross(item))} zł
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          {confirmDelete ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <span style={{ color: "#dc2626", whiteSpace: "nowrap" }}>Usunąć?</span>
              <button
                onClick={del}
                disabled={busy}
                className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: "#dc2626", border: "none", cursor: "pointer" }}
              >
                Tak
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-0.5 text-xs font-semibold"
                style={{ background: "#e2e8f0", border: "none", cursor: "pointer", color: "#475569" }}
              >
                Nie
              </button>
            </span>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
              >
                Edytuj
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              >
                Usuń
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

type AddFormState = {
  serviceId: Id<"servicePricing"> | "";
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: number;
  discountPercent: string;
};

const EMPTY_FORM: AddFormState = {
  serviceId: "",
  name: "",
  description: "",
  quantity: "1",
  unit: "szt.",
  unitPrice: "",
  vatRate: 0,
  discountPercent: "0",
};

export default function OrderLineItems({
  orderId,
  fakturownia,
  invoicePlan,
}: {
  orderId: Id<"orders">;
  fakturownia?: Doc<"orders">["fakturownia"];
  invoicePlan?: Doc<"orders">["invoicePlan"];
}) {
  const data = useQuery(api.orderLineItems.listByOrder, { orderId });
  const fkConfig = useQuery(api.fakturownia.getConfig);
  const numberConflict = useQuery(api.fakturownia.checkOrderNumberConflict, { orderId });
  const addItem = useMutation(api.orderLineItems.add);
  const updateItem = useMutation(api.orderLineItems.update);
  const removeItem = useMutation(api.orderLineItems.remove);
  const pushEstimate = useAction(api.fakturownia.pushOrderEstimate);
  const saveInvoicePlan = useMutation(api.orders.saveInvoicePlan);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fkBusy, setFkBusy] = useState<string | null>(null);
  const [fkMessage, setFkMessage] = useState<string | null>(null);
  const [fkError, setFkError] = useState<string | null>(null);
  const [showNumberConflictModal, setShowNumberConflictModal] = useState(false);

  const [tranches, setTranches] = useState<Array<{ kind: "vat" | "advance" | "final"; pct: number }>>(() => {
    if (invoicePlan?.type === "vat") {
      return [{ kind: "vat" as const, pct: 100 }];
    }
    if (invoicePlan?.advancePct != null && invoicePlan.advancePct > 0) {
      return [
        { kind: "advance" as const, pct: invoicePlan.advancePct },
        { kind: "final" as const, pct: 100 - invoicePlan.advancePct },
      ];
    }
    return [];
  });
  const [planSaved, setPlanSaved] = useState(invoicePlan != null);
  const [planSaving, setPlanSaving] = useState(false);

  async function confirmInvoicePlan() {
    setPlanSaving(true);
    try {
      const hasVat = tranches.some((t) => t.kind === "vat");
      const hasAdvance = tranches.some((t) => t.kind === "advance");
      const advancePct = tranches.find((t) => t.kind === "advance")?.pct ?? 0;
      const type = hasVat ? "vat" : hasAdvance ? "advance_final" : "none";
      await saveInvoicePlan({ orderId, type, advancePct });
      setPlanSaved(true);
    } finally {
      setPlanSaving(false);
    }
  }


  function onVatChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const rate = parseInt(e.target.value);
    setForm((f) => ({ ...f, vatRate: rate, name: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await addItem({
        orderId,
        serviceId: form.serviceId || undefined,
        name: form.name,
        description: form.description || undefined,
        quantity: parseFloat(form.quantity) || 1,
        unit: form.unit,
        unitPrice: parseFloat(form.unitPrice) || 0,
        vatRate: form.vatRate,
        discountPercent: parseFloat(form.discountPercent) || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: Id<"orderLineItems">, data: EditState) {
    await updateItem({
      id,
      ...data,
      discountPercent: (data.discountPercent ?? 0) > 0 ? data.discountPercent : undefined,
      description: data.description || undefined,
    });
  }

  async function handleDelete(id: Id<"orderLineItems">) {
    await removeItem({ id });
  }

  if (!data) {
    return <div className="py-8 text-center text-sm text-slate-400">Ładowanie...</div>;
  }

  const { items, totals } = data;

  const fkBaseUrl =
    fkConfig?.subdomain?.trim() &&
    `https://${fkConfig.subdomain.trim().replace(/\.fakturownia\.pl$/i, "")}.fakturownia.pl`;

  async function runFk(
    label: string,
    fn: () => Promise<unknown>,
    successMsg?: string,
  ) {
    setFkMessage(null);
    setFkError(null);
    setFkBusy(label);
    try {
      await fn();
      setFkMessage(successMsg ?? "Gotowe.");
    } catch (err) {
      setFkError(err instanceof Error ? err.message : "Błąd Fakturowni");
    } finally {
      setFkBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pozycja</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Ilość</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Cena netto</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Rabat</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">VAT</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Wartość brutto</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <LineItemRow
                  key={item._id}
                  item={item}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center">
          <p className="text-sm text-slate-400">Brak pozycji — dodaj pierwszą pozycję wyceny</p>
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Wartość netto</span>
                <span className="font-medium">{fmt(totals.totalNet)} zł</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>VAT</span>
                <span className="font-medium">{fmt(totals.totalVat)} zł</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Razem brutto</span>
                <span>{fmt(totals.totalGross)} zł</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowa pozycja</h3>

          {/* VAT selector — always active, unlocks the rest of the form */}
          <div className="mb-5">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              VAT % <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wider">Wybierz najpierw</span>
            </label>
            <select
              className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-900 ring-2 ring-blue-200 focus:outline-none focus:ring-blue-400"
              value={form.vatRate}
              onChange={onVatChange}
            >
              {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>

          {/* Locked overlay hint */}
          {form.vatRate === 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Wybierz stawkę VAT (23% lub 8%), aby odblokować pozostałe pola formularza
            </div>
          )}

          {/* Rest of form — locked when vatRate === 0 */}
          <div className={form.vatRate === 0 ? "pointer-events-none select-none opacity-40" : ""}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
                <NameSelector
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  vatRate={form.vatRate}
                  disabled={form.vatRate === 0}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="opcjonalny opis"
                  disabled={form.vatRate === 0}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ilość *</label>
                <input
                  required={form.vatRate !== 0}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  disabled={form.vatRate === 0}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Jedn.</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={form.vatRate === 0}
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cena netto *</label>
                <input
                  required={form.vatRate !== 0}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.unitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  disabled={form.vatRate === 0}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rabat %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                  placeholder="0"
                  disabled={form.vatRate === 0}
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy || form.vatRate === 0 || !form.name}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Dodaj pozycję
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
              className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="text-lg leading-none">+</span>
          Dodaj pozycję
        </button>
      )}

      {/* Typ faktury (do umowy) */}
      {items.length > 0 && (() => {
        const hasVat = tranches.some((t) => t.kind === "vat");
        const hasAdvance = tranches.some((t) => t.kind === "advance");
        const hasFinal = tranches.some((t) => t.kind === "final");
        const isEmpty = tranches.length === 0;
        const advanceTranche = tranches.find((t) => t.kind === "advance");

        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Typ faktury (do umowy)
              </h3>
              {planSaved && !planSaving && (
                <span className="text-xs font-medium text-emerald-600">Zatwierdzone</span>
              )}
            </div>

            {isEmpty && (
              <p className="mb-3 text-sm text-slate-500">Wybierz typ fakturowania dla tej umowy.</p>
            )}

            {tranches.length > 0 && (
              <table className="mb-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left text-xs font-medium text-slate-400">Typ faktury</th>
                    <th className="pb-2 text-center text-xs font-medium text-slate-400">Udział</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-400">Kwota brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {hasVat && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-700">Faktura VAT</td>
                      <td className="py-2 text-center text-slate-600">100%</td>
                      <td className="py-2 text-right font-medium text-slate-900">{fmt(totals.totalGross)} zł</td>
                    </tr>
                  )}
                  {hasAdvance && advanceTranche && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-700">Faktura zaliczkowa</td>
                      <td className="py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex gap-1">
                            {[20, 30, 50, 70].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setPlanSaved(false);
                                  setTranches((ts) =>
                                    ts.map((t) =>
                                      t.kind === "advance" ? { ...t, pct: preset } :
                                      t.kind === "final" ? { ...t, pct: 100 - preset } : t,
                                    ),
                                  );
                                }}
                                className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                                  advanceTranche.pct === preset
                                    ? "bg-slate-700 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                          <div className="inline-flex items-center gap-1">
                            <input
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={1}
                              max={99}
                              value={advanceTranche.pct}
                              onChange={(e) => {
                                setPlanSaved(false);
                                const v = Math.min(99, Math.max(1, parseInt(e.target.value) || 1));
                                setTranches((ts) =>
                                  ts.map((t) =>
                                    t.kind === "advance" ? { ...t, pct: v } :
                                    t.kind === "final" ? { ...t, pct: 100 - v } : t,
                                  ),
                                );
                              }}
                              className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        {fmt((totals.totalGross * advanceTranche.pct) / 100)} zł
                      </td>
                    </tr>
                  )}
                  {hasFinal && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-700">Faktura końcowa</td>
                      <td className="py-2 text-center text-slate-600">{100 - (advanceTranche?.pct ?? 0)}%</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        {fmt((totals.totalGross * (100 - (advanceTranche?.pct ?? 0))) / 100)} zł
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {isEmpty && (
                <>
                  <button
                    type="button"
                    onClick={() => { setPlanSaved(false); setTranches([{ kind: "vat", pct: 100 }]); }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Faktura VAT
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPlanSaved(false); setTranches([{ kind: "advance", pct: 50 }]); }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Faktura zaliczkowa
                  </button>
                </>
              )}
              {hasAdvance && !hasFinal && (
                <button
                  type="button"
                  onClick={() => {
                    setPlanSaved(false);
                    setTranches((ts) => [
                      ...ts,
                      { kind: "final", pct: 100 - (ts.find((t) => t.kind === "advance")?.pct ?? 50) },
                    ]);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Faktura końcowa
                </button>
              )}
              {!isEmpty && !planSaved && (
                <button
                  type="button"
                  onClick={() => void confirmInvoicePlan()}
                  disabled={planSaving}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {planSaving ? "Zapisywanie..." : "Zatwierdź"}
                </button>
              )}
              {!isEmpty && (
                <button
                  type="button"
                  onClick={() => { setPlanSaved(false); setTranches([]); }}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Resetuj
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Fakturownia */}
      {items.length > 0 && fkConfig?.hasApiToken && fkConfig.subdomain?.trim() && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Fakturownia
          </h3>
          {fkMessage && (
            <p className="mb-3 text-sm text-emerald-700">{fkMessage}</p>
          )}
          {fkError && (
            <p className="mb-3 text-sm text-red-600">{fkError}</p>
          )}
          {fakturownia?.estimateId ? (
            <div className="mb-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Zamówienie w Fakturowni:</span>{" "}
                {fakturownia.estimateNumber ?? `ID ${fakturownia.estimateId}`}
                {fkBaseUrl && (
                  <>
                    {" "}
                    <a
                      href={`${fkBaseUrl}/invoices/${fakturownia.estimateId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Otwórz
                    </a>
                  </>
                )}
              </p>
              {fakturownia.estimateSyncedAt && (
                <p className="text-xs text-slate-500">
                  Ostatnio wysłano:{" "}
                  {new Date(fakturownia.estimateSyncedAt).toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-600">
              Wyślij pozycje wyceny jako zamówienie do Fakturowni. Dane klienta zostaną pobrane z CRM.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!fkBusy}
              onClick={() => {
                if (!fakturownia?.estimateId && numberConflict?.conflict) {
                  setShowNumberConflictModal(true);
                  return;
                }
                runFk(
                  "estimate",
                  () => pushEstimate({ orderId }),
                  fakturownia?.estimateId
                    ? "Zamówienie zaktualizowane w Fakturowni."
                    : "Zamówienie wysłane do Fakturowni.",
                );
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {fkBusy === "estimate"
                ? "Wysyłanie…"
                : fakturownia?.estimateId
                  ? "Wyślij ponownie do Fakturowni"
                  : "Wyślij zamówienie do Fakturowni"}
            </button>
          </div>
        </div>
      )}
      {items.length > 0 && fkConfig === null && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Skonfiguruj integrację Fakturowni (token API i subdomena) w{" "}
          <span className="font-semibold">Ustawienia → Fakturownia</span>, aby wysłać wycenę jako zamówienie.
        </div>
      )}
      {items.length > 0 && fkConfig && !fkConfig.hasApiToken && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Uzupełnij token API Fakturowni w ustawieniach lub ustaw zmienną{" "}
          <code className="rounded bg-white px-1">FAKTUROWNIA_API_TOKEN</code> w Convex.
        </div>
      )}

      {showNumberConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Numer zlecenia zajęty</h2>
            <p className="mb-4 text-sm text-slate-600">
              Numer zlecenia{" "}
              <span className="font-semibold">{numberConflict?.number}</span>{" "}
              istnieje już w Fakturowni jako inne zamówienie. Aby wysłać tę wycenę, najpierw zmień numer zlecenia lub zamówienia w Fakturowni.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNumberConflictModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Rozumiem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
