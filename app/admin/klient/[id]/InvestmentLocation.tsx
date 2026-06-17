"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AddressSearch, { AddressData } from "@/components/AddressSearch";

interface Props {
  orderId: Id<"orders">;
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentApartmentNumber?: string;
  investmentPostalCode?: string;
  investmentCity?: string;
}

function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

export default function InvestmentLocation({
  orderId,
  investmentStreet,
  investmentBuildingNumber,
  investmentApartmentNumber,
  investmentPostalCode,
  investmentCity,
}: Props) {
  const updateOrder = useMutation(api.orders.update);
  const [editing, setEditing] = useState(false);

  const [street, setStreet] = useState(investmentStreet ?? "");
  const [building, setBuilding] = useState(investmentBuildingNumber ?? "");
  const [apartment, setApartment] = useState(investmentApartmentNumber ?? "");
  const [postal, setPostal] = useState(investmentPostalCode ?? "");
  const [city, setCity] = useState(investmentCity ?? "");

  function handleEdit() {
    setStreet(investmentStreet ?? "");
    setBuilding(investmentBuildingNumber ?? "");
    setApartment(investmentApartmentNumber ?? "");
    setPostal(investmentPostalCode ?? "");
    setCity(investmentCity ?? "");
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  async function handleSave() {
    await updateOrder({
      orderId,
      investmentStreet: street,
      investmentBuildingNumber: building,
      investmentApartmentNumber: apartment,
      investmentPostalCode: postal,
      investmentCity: city,
    });
    setEditing(false);
  }

  function handleAddressSelect(address: AddressData) {
    if (address.street) setStreet(address.street);
    if (address.buildingNumber) setBuilding(address.buildingNumber);
    if (address.postalCode) setPostal(address.postalCode);
    if (address.city) setCity(address.city);
  }

  const hasAddress = Boolean(investmentStreet || investmentCity);

  const primaryLine = [
    [investmentStreet, investmentBuildingNumber].filter(Boolean).join(" "),
    investmentApartmentNumber ? `m. ${investmentApartmentNumber}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  const secondaryLine = [investmentPostalCode, investmentCity]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [primaryLine, secondaryLine].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  // ── Tryb edycji ──
  if (editing) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 14,
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--panel-2)",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            <PinIcon />
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              color: "var(--text-mute)",
            }}
          >
            Lokalizacja inwestycji
          </span>
        </div>

        <AddressSearch onSelect={handleAddressSelect} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px", gap: 6 }}>
          <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Ulica" style={inputStyle} />
          <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Nr domu" style={inputStyle} />
          <input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="Nr lok." style={inputStyle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 6 }}>
          <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="00-000" style={inputStyle} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Miejscowość" style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => void handleSave()} className="btn primary" style={{ fontSize: 11, padding: "5px 14px" }}>
            Zapisz
          </button>
          <button onClick={handleCancel} className="btn" style={{ fontSize: 11, padding: "5px 12px" }}>
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  // ── Brak adresu: przycisk dodania ──
  if (!hasAddress) {
    return (
      <button
        onClick={handleEdit}
        title="Dodaj adres inwestycji"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px dashed var(--line)",
          background: "transparent",
          color: "var(--text-mute)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <PinIcon size={13} />
        Dodaj adres inwestycji
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    );
  }

  // ── Widok adresu (pigułka z ikoną, mapą i edycją) ──
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px 6px 6px",
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "var(--card)",
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        <PinIcon size={17} />
      </span>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.25 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.7,
            color: "var(--text-mute)",
          }}
        >
          Lokalizacja inwestycji
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-strong)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={fullAddress}
        >
          {primaryLine || secondaryLine}
        </span>
        {primaryLine && secondaryLine && (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-mute)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {secondaryLine}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 2 }}>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Otwórz w Google Maps"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            color: "var(--text-mute)",
            textDecoration: "none",
          }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
        </a>
        <button
          onClick={handleEdit}
          title="Edytuj adres inwestycji"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--text-mute)",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "5px 8px",
  border: "1px solid var(--line)",
  borderRadius: 5,
  background: "var(--card)",
  color: "var(--text)",
  fontFamily: "inherit",
  width: "100%",
  outline: "none",
};
