"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const VAT_RATES = [23, 8, 0];
const UNITS = ["szt.", "m²", "mb", "usł.", "kpl.", "godz."];
const PRODUCT_TYPES = [
  "Stolarka okienna",
  "Stolarka drzwiowa",
  "Brama garażowa",
  "Zabudowa tarasu",
  "Konstrukcje aluminiowe",
  "Ogrodzenie",
  "System przeciwsłoneczny",
];

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
    if (!confirm(`Usunąć pozycję "${item.name}"?`)) return;
    setBusy(true);
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
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                >
                  <option value="">— wybierz —</option>
                  {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
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
    <tr className="group border-b border-slate-100 hover:bg-slate-50">
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
        <div className="invisible flex justify-end gap-1 group-hover:visible">
          <button
            onClick={startEdit}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
          >
            Edytuj
          </button>
          <button
            onClick={del}
            disabled={busy}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            Usuń
          </button>
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
  vatRate: 23,
  discountPercent: "0",
};

export default function OrderLineItems({
  orderId,
  fakturownia,
}: {
  orderId: Id<"orders">;
  fakturownia?: Doc<"orders">["fakturownia"];
}) {
  const data = useQuery(api.orderLineItems.listByOrder, { orderId });
  const catalog = useQuery(api.servicePricing.list, {});
  const fkConfig = useQuery(api.fakturownia.getConfig);
  const addItem = useMutation(api.orderLineItems.add);
  const updateItem = useMutation(api.orderLineItems.update);
  const removeItem = useMutation(api.orderLineItems.remove);
  const pushEstimate = useAction(api.fakturownia.pushOrderEstimate);
  const pushAdvance = useAction(api.fakturownia.pushAdvanceInvoice);
  const pushFinal = useAction(api.fakturownia.pushFinalInvoice);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fkBusy, setFkBusy] = useState<string | null>(null);
  const [fkMessage, setFkMessage] = useState<string | null>(null);

  function onCatalogSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value as Id<"servicePricing"> | "";
    if (!id) {
      setForm((f) => ({ ...f, serviceId: "", name: "", unitPrice: "", unit: "szt.", vatRate: 23 }));
      return;
    }
    const entry = catalog?.find((c) => c._id === id);
    if (entry) {
      setForm((f) => ({
        ...f,
        serviceId: id,
        name: entry.name,
        unit: entry.unit,
        unitPrice: String(entry.unitPrice),
        vatRate: entry.vatRate,
      }));
    }
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

  const advancePct = fkConfig?.advancePercent ?? 30;
  const finalPct = 100 - advancePct;
  const plannedAdvanceGross =
    items.length > 0
      ? Math.round(totals.totalGross * (advancePct / 100) * 100) / 100
      : 0;
  const plannedFinalGross =
    items.length > 0
      ? Math.round((totals.totalGross - plannedAdvanceGross) * 100) / 100
      : 0;

  const hasAdvance = fakturownia?.invoices.some((i) => i.kind === "advance") ?? false;
  const hasFinal = fakturownia?.invoices.some((i) => i.kind === "final") ?? false;
  const fkBaseUrl =
    fkConfig?.subdomain?.trim() &&
    `https://${fkConfig.subdomain.trim().replace(/\.fakturownia\.pl$/i, "")}.fakturownia.pl`;

  async function runFk(
    label: string,
    fn: () => Promise<unknown>,
  ) {
    setFkMessage(null);
    setError(null);
    setFkBusy(label);
    try {
      await fn();
      setFkMessage("Gotowe.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd Fakturowni");
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
              <div className="mt-4 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-600">
                <div className="mb-1 font-semibold uppercase tracking-wider text-slate-500">
                  Podział faktur (brutto)
                </div>
                <div className="flex justify-between">
                  <span>
                    Zaliczka ({advancePct}%)
                  </span>
                  <span className="font-medium text-slate-800">
                    {fmt(plannedAdvanceGross)} zł
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    Faktura końcowa ({finalPct}%)
                  </span>
                  <span className="font-medium text-slate-800">
                    {fmt(plannedFinalGross)} zł
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Procent zaliczki ustawiasz w Ustawienia → Fakturownia. Kwoty są wyliczone od sumy brutto wyceny.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fakturownia */}
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
      {items.length > 0 && fkConfig?.hasApiToken && fkConfig.subdomain?.trim() && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Fakturownia
          </h3>
          {fkMessage && (
            <p className="mb-3 text-sm text-emerald-700">{fkMessage}</p>
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
              {fakturownia.oid && (
                <p className="text-xs text-slate-500">OID: {fakturownia.oid}</p>
              )}
              {fakturownia.invoices.length > 0 && (
                <ul className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  {fakturownia.invoices.map((inv) => (
                    <li
                      key={`${inv.kind}-${inv.remoteId}-${inv.createdAt}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                    >
                      <span>
                        {inv.kind === "advance" ? "Faktura zaliczkowa" : "Faktura końcowa"}
                        {inv.number ? ` (${inv.number})` : ""}
                        {inv.grossAmount != null ? ` — ${fmt(inv.grossAmount)} zł brutto` : ""}
                      </span>
                      {fkBaseUrl && (
                        <a
                          href={`${fkBaseUrl}/invoices/${inv.remoteId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Podgląd
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-600">
              Wyślij pozycje wyceny jako zamówienie w Fakturowni. Potem wystaw zaliczkę i fakturę końcową z poziomu tej strony.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!fkBusy || !!fakturownia?.estimateId}
              onClick={() =>
                runFk("estimate", () => pushEstimate({ orderId }))
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {fkBusy === "estimate" ? "Wysyłanie…" : "Wyślij zamówienie (wycenę)"}
            </button>
            <button
              type="button"
              disabled={
                !!fkBusy ||
                !fakturownia?.estimateId ||
                hasAdvance
              }
              onClick={() => runFk("advance", () => pushAdvance({ orderId }))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {fkBusy === "advance" ? "Wystawianie…" : `Faktura zaliczkowa (${advancePct}%)`}
            </button>
            <button
              type="button"
              disabled={
                !!fkBusy ||
                !fakturownia?.estimateId ||
                !hasAdvance ||
                hasFinal
              }
              onClick={() => runFk("final", () => pushFinal({ orderId }))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {fkBusy === "final" ? "Wystawianie…" : `Faktura końcowa (${finalPct}%)`}
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowa pozycja</h3>

          {/* Catalog select */}
          <div className="mb-4">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.serviceId}
              onChange={onCatalogSelect}
            >
              <option value="">— Pozycja własna —</option>
              {(catalog ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({fmt(c.unitPrice)} zł / {c.unit}, VAT {c.vatRate}%)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
              <select
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              >
                <option value="">— wybierz —</option>
                {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="opcjonalny opis"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ilość *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Jedn.</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              >
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cena netto *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">VAT %</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={form.vatRate}
                onChange={(e) => setForm((f) => ({ ...f, vatRate: parseInt(e.target.value) }))}
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.discountPercent}
                onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
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
    </div>
  );
}
