"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

export type ItemCategory = "service" | "installation" | "extras";

export type EstimateItem = {
  id: string;
  category: ItemCategory;
  name: string;
  specs: string;
  qty: number;
  priceNet: number;
  vat: number;
};

export type EstimateClient = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  clientType: "individual" | "business";
  nip?: string;
  companyName?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentPostalCode?: string;
  investmentCity?: string;
};

export type EstimateCardData = {
  title: string;
  client: EstimateClient;
  items: EstimateItem[];
  discountPercent: number;
};

export function computeSummary(items: EstimateItem[], discountPercent: number) {
  const netTotal = items.reduce((sum, i) => sum + i.qty * i.priceNet, 0);
  const discountAmount = netTotal * (discountPercent / 100);
  const netAfterDiscount = netTotal - discountAmount;
  const vatTotal = items.reduce((sum, i) => {
    const itemNet = i.qty * i.priceNet;
    const itemNetAfterDiscount = itemNet * (1 - discountPercent / 100);
    return sum + itemNetAfterDiscount * (i.vat / 100);
  }, 0);
  const grossTotal = netAfterDiscount + vatTotal;
  return { netTotal, discountAmount, netAfterDiscount, vatTotal, grossTotal };
}

// ── Helpers ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  service: "USŁUGA",
  installation: "MONTAŻ",
  extras: "DODATKI",
};

const CATEGORY_DEFAULT_VAT: Record<ItemCategory, number> = {
  service: 8,
  installation: 8,
  extras: 23,
};

const DISCOUNT_OPTIONS = [0, 3, 5, 10, 15, 20];

const fmt = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Inline-edit input ──────────────────────────────────────────────

function InlineInput({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  style,
  inputStyle,
  suffix,
}: {
  value: string | number;
  onChange: (val: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  suffix?: string;
}) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", ...style }}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          border: "1px solid transparent",
          borderRadius: 4,
          padding: "3px 6px",
          fontSize: 12.5,
          fontFamily: "inherit",
          color: "var(--text)",
          background: "transparent",
          outline: "none",
          transition: "border-color 0.15s, background 0.15s",
          ...(disabled ? { opacity: 0.7, cursor: "default" } : {}),
          ...inputStyle,
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = "var(--line)";
        }}
        onMouseLeave={(e) => {
          if (!disabled && document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "transparent";
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = "var(--accent-line)";
            e.currentTarget.style.background = "var(--panel-2)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(74,187,195,0.08)";
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {suffix && (
        <span className="mute" style={{ position: "absolute", right: 6, fontSize: 11, pointerEvents: "none" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

interface EstimateCardViewProps {
  card: EstimateCardData;
  readOnly?: boolean;
  outdatedLabel?: string;
  onCardUpdate?: (updatedCard: EstimateCardData) => void;
}

export default function EstimateCardView({ card, readOnly, outdatedLabel, onCardUpdate }: EstimateCardViewProps) {
  const [draft, setDraft] = useState<EstimateCardData>(() => JSON.parse(JSON.stringify(card)));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasChanged = useRef(false);

  // Reset draft when card prop changes (new card rendered)
  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(card)));
    hasChanged.current = false;
  }, [card]);

  const commitUpdate = useCallback((updated: EstimateCardData) => {
    if (onCardUpdate && !readOnly) {
      onCardUpdate(updated);
    }
  }, [onCardUpdate, readOnly]);

  const scheduleSave = useCallback((updated: EstimateCardData) => {
    hasChanged.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitUpdate(updated);
    }, 2000);
  }, [commitUpdate]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateClient = (field: keyof EstimateClient, value: string) => {
    const updated = { ...draft, client: { ...draft.client, [field]: value } };
    setDraft(updated);
    scheduleSave(updated);
  };

  const updateItem = (itemId: string, field: keyof EstimateItem, value: string | number) => {
    const updated = {
      ...draft,
      items: draft.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    };
    setDraft(updated);
    scheduleSave(updated);
  };

  const addItem = (category: ItemCategory) => {
    const newItem: EstimateItem = {
      id: `item-${Date.now()}`,
      category,
      name: "",
      specs: "",
      qty: 1,
      priceNet: 0,
      vat: CATEGORY_DEFAULT_VAT[category],
    };
    const updated = { ...draft, items: [...draft.items, newItem] };
    setDraft(updated);
    scheduleSave(updated);
  };

  const removeItem = (itemId: string) => {
    const updated = { ...draft, items: draft.items.filter((i) => i.id !== itemId) };
    setDraft(updated);
    scheduleSave(updated);
  };

  const setDiscount = (pct: number) => {
    const updated = { ...draft, discountPercent: pct };
    setDraft(updated);
    scheduleSave(updated);
  };

  const summary = computeSummary(draft.items, draft.discountPercent);
  const disabled = !!readOnly;

  const labelStyle: React.CSSProperties = { fontSize: 10.5, color: "var(--text-mute)", marginBottom: 2 };
  const sectionCategories: ItemCategory[] = ["service", "installation", "extras"];

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: "var(--panel)",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        opacity: readOnly ? 0.7 : 1,
        position: "relative",
      }}
    >
      {/* Outdated banner */}
      {readOnly && outdatedLabel && (
        <div
          style={{
            padding: "6px 16px",
            background: "var(--warn-soft)",
            color: "var(--warn)",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "center",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {outdatedLabel}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel-2)",
        }}
      >
        <FileSpreadsheet size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text-strong)" }}>
          {draft.title}
        </span>
      </div>

      {/* Client Section */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="up mute" style={{ marginBottom: 8, fontSize: 10 }}>Klient</div>

        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <div>
            <div style={labelStyle}>Imię</div>
            <InlineInput value={draft.client.firstName} onChange={(v) => updateClient("firstName", v)} placeholder="Imię" disabled={disabled} />
          </div>
          <div>
            <div style={labelStyle}>Nazwisko</div>
            <InlineInput value={draft.client.lastName} onChange={(v) => updateClient("lastName", v)} placeholder="Nazwisko" disabled={disabled} />
          </div>
        </div>

        {/* Contact row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <div>
            <div style={labelStyle}>Telefon</div>
            <InlineInput value={draft.client.phone ?? ""} onChange={(v) => updateClient("phone", v)} placeholder="np. 600 123 456" disabled={disabled} />
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <InlineInput value={draft.client.email ?? ""} onChange={(v) => updateClient("email", v)} placeholder="email@example.com" disabled={disabled} />
          </div>
        </div>

        {/* Client type toggle */}
        <div style={{ marginBottom: 6 }}>
          <div style={labelStyle}>Typ klienta</div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["individual", "business"] as const).map((t) => (
              <button
                key={t}
                disabled={disabled}
                onClick={() => updateClient("clientType", t)}
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  cursor: disabled ? "default" : "pointer",
                  background: draft.client.clientType === t ? "var(--accent-soft)" : "transparent",
                  color: draft.client.clientType === t ? "var(--accent)" : "var(--text-dim)",
                  borderColor: draft.client.clientType === t ? "var(--accent-line)" : "var(--line)",
                  fontWeight: draft.client.clientType === t ? 600 : 400,
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {t === "individual" ? "Indywidualny" : "Firma"}
              </button>
            ))}
          </div>
        </div>

        {/* Business fields */}
        {draft.client.clientType === "business" && (
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 6, marginBottom: 6 }}>
            <div>
              <div style={labelStyle}>NIP</div>
              <InlineInput value={draft.client.nip ?? ""} onChange={(v) => updateClient("nip", v)} placeholder="NIP" disabled={disabled} />
            </div>
            <div>
              <div style={labelStyle}>Nazwa firmy</div>
              <InlineInput value={draft.client.companyName ?? ""} onChange={(v) => updateClient("companyName", v)} placeholder="Nazwa firmy" disabled={disabled} />
            </div>
          </div>
        )}

        {/* Client address */}
        <div style={{ marginBottom: 6 }}>
          <div style={labelStyle}>Adres klienta</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 1fr", gap: 4 }}>
            <InlineInput value={draft.client.street ?? ""} onChange={(v) => updateClient("street", v)} placeholder="Ulica" disabled={disabled} />
            <InlineInput value={draft.client.buildingNumber ?? ""} onChange={(v) => updateClient("buildingNumber", v)} placeholder="Nr" disabled={disabled} />
            <InlineInput value={draft.client.postalCode ?? ""} onChange={(v) => updateClient("postalCode", v)} placeholder="Kod" disabled={disabled} />
            <InlineInput value={draft.client.city ?? ""} onChange={(v) => updateClient("city", v)} placeholder="Miasto" disabled={disabled} />
          </div>
        </div>

        {/* Investment address */}
        <div>
          <div style={labelStyle}>Adres inwestycji</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 1fr", gap: 4 }}>
            <InlineInput value={draft.client.investmentStreet ?? ""} onChange={(v) => updateClient("investmentStreet", v)} placeholder="Ulica" disabled={disabled} />
            <InlineInput value={draft.client.investmentBuildingNumber ?? ""} onChange={(v) => updateClient("investmentBuildingNumber", v)} placeholder="Nr" disabled={disabled} />
            <InlineInput value={draft.client.investmentPostalCode ?? ""} onChange={(v) => updateClient("investmentPostalCode", v)} placeholder="Kod" disabled={disabled} />
            <InlineInput value={draft.client.investmentCity ?? ""} onChange={(v) => updateClient("investmentCity", v)} placeholder="Miasto" disabled={disabled} />
          </div>
        </div>
      </div>

      {/* Item Sections */}
      {sectionCategories.map((cat) => {
        const catItems = draft.items.filter((i) => i.category === cat);
        const catTotal = catItems.reduce((s, i) => s + i.qty * i.priceNet, 0);

        return (
          <div key={cat} style={{ borderBottom: "1px solid var(--line)" }}>
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px",
                background: "var(--panel-2)",
              }}
            >
              <span className="up" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
                {CATEGORY_LABELS[cat]}
              </span>
              {!disabled && (
                <button
                  onClick={() => addItem(cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--accent)",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Plus size={11} />
                  Dodaj
                </button>
              )}
            </div>

            {/* Items */}
            {catItems.length === 0 && (
              <div className="mute" style={{ padding: "10px 16px", fontSize: 11, fontStyle: "italic" }}>
                Brak pozycji
              </div>
            )}
            {catItems.map((item) => {
              const lineTotal = item.qty * item.priceNet;
              return (
                <div
                  key={item.id}
                  className="estimate-item-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 50px 100px 60px auto 24px",
                    gap: 4,
                    alignItems: "center",
                    padding: "6px 16px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {/* Name + specs */}
                  <div style={{ minWidth: 0 }}>
                    <InlineInput
                      value={item.name}
                      onChange={(v) => updateItem(item.id, "name", v)}
                      placeholder="Nazwa pozycji"
                      disabled={disabled}
                      inputStyle={{ fontWeight: 600, fontSize: 12.5 }}
                    />
                    <InlineInput
                      value={item.specs}
                      onChange={(v) => updateItem(item.id, "specs", v)}
                      placeholder="Specyfikacja"
                      disabled={disabled}
                      inputStyle={{ fontSize: 11, color: "var(--text-mute)" }}
                    />
                  </div>

                  {/* Qty */}
                  <InlineInput
                    value={item.qty}
                    onChange={(v) => updateItem(item.id, "qty", Math.max(1, parseInt(v) || 1))}
                    type="number"
                    disabled={disabled}
                    inputStyle={{ textAlign: "center", fontSize: 12 }}
                    suffix="szt."
                  />

                  {/* Price */}
                  <InlineInput
                    value={item.priceNet}
                    onChange={(v) => updateItem(item.id, "priceNet", Math.max(0, parseFloat(v) || 0))}
                    type="number"
                    disabled={disabled}
                    inputStyle={{ textAlign: "right", fontSize: 12 }}
                    suffix="zł"
                  />

                  {/* VAT select */}
                  <select
                    value={item.vat}
                    onChange={(e) => updateItem(item.id, "vat", parseInt(e.target.value))}
                    disabled={disabled}
                    style={{
                      border: "1px solid transparent",
                      borderRadius: 4,
                      padding: "3px 4px",
                      fontSize: 11,
                      fontFamily: "inherit",
                      color: "var(--text-dim)",
                      background: "transparent",
                      outline: "none",
                      cursor: disabled ? "default" : "pointer",
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = "var(--line)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                    onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = "var(--accent-line)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <option value={0}>0%</option>
                    <option value={8}>8%</option>
                    <option value={23}>23%</option>
                  </select>

                  {/* Line total */}
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmt(lineTotal)} zł
                  </span>

                  {/* Delete */}
                  {!disabled ? (
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        padding: 2,
                        color: "var(--text-mute)",
                        opacity: 0.3,
                        transition: "opacity 0.1s, color 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--bad)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; e.currentTarget.style.color = "var(--text-mute)"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : <span />}
                </div>
              );
            })}

            {/* Section subtotal */}
            {catItems.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "6px 16px",
                  fontSize: 11,
                  color: "var(--text-dim)",
                }}
              >
                <span>Sekcja: </span>
                <span className="mono" style={{ fontWeight: 600, marginLeft: 4 }}>
                  {fmt(catTotal)} zł
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div style={{ background: "var(--panel-2)", padding: "12px 16px" }}>
        {/* Net total */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-dim)", marginBottom: 4 }}>
          <span>Suma netto:</span>
          <span className="mono">{fmt(summary.netTotal)} zł</span>
        </div>

        {/* Discount */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "var(--text-dim)", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Rabat:</span>
            <select
              value={draft.discountPercent}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (isNaN(val)) return;
                setDiscount(val);
              }}
              disabled={disabled}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 11,
                fontFamily: "inherit",
                color: "var(--text)",
                background: "var(--panel)",
                outline: "none",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              {DISCOUNT_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}%</option>
              ))}
              {!DISCOUNT_OPTIONS.includes(draft.discountPercent) && (
                <option value={draft.discountPercent}>{draft.discountPercent}%</option>
              )}
            </select>
          </div>
          <span className="mono" style={{ color: summary.discountAmount > 0 ? "var(--bad)" : "var(--text-dim)" }}>
            {summary.discountAmount > 0 ? "-" : ""}{fmt(summary.discountAmount)} zł
          </span>
        </div>

        {/* Net after discount */}
        {summary.discountAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-dim)", marginBottom: 4 }}>
            <span>Netto po rabacie:</span>
            <span className="mono">{fmt(summary.netAfterDiscount)} zł</span>
          </div>
        )}

        {/* VAT */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-dim)", marginBottom: 8 }}>
          <span>Podatek VAT:</span>
          <span className="mono">{fmt(summary.vatTotal)} zł</span>
        </div>

        {/* Gross total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--accent)",
            paddingTop: 8,
            borderTop: "1px solid var(--line)",
          }}
        >
          <span>RAZEM BRUTTO:</span>
          <span className="mono" style={{ fontSize: 14 }}>
            {fmt(summary.grossTotal)} zł
          </span>
        </div>
      </div>
    </div>
  );
}
