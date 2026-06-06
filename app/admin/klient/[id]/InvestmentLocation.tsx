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

  const hasAddress = investmentStreet || investmentCity;

  const addressLine = [
    [investmentStreet, investmentBuildingNumber].filter(Boolean).join(" "),
    investmentApartmentNumber ? `m. ${investmentApartmentNumber}` : "",
    [investmentPostalCode, investmentCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AddressSearch onSelect={handleAddressSelect} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px", gap: 6 }}>
          <input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Ulica"
            style={inputStyle}
          />
          <input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Nr domu"
            style={inputStyle}
          />
          <input
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="Nr lok."
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 6 }}>
          <input
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            placeholder="00-000"
            style={inputStyle}
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Miejscowość"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => void handleSave()}
            className="btn primary"
            style={{ fontSize: 11, padding: "4px 12px" }}
          >
            Zapisz
          </button>
          <button
            onClick={handleCancel}
            className="btn"
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 28 }}>
      <svg
        width="13"
        height="13"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        style={{ color: "var(--text-mute)", flexShrink: 0 }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
        />
      </svg>

      <span
        style={{
          fontSize: 12.5,
          color: hasAddress ? "var(--text)" : "var(--text-mute)",
          flex: 1,
          fontStyle: hasAddress ? "normal" : "italic",
        }}
      >
        {hasAddress ? addressLine : "Brak adresu inwestycji"}
      </span>

      <button
        onClick={handleEdit}
        className="btn"
        style={{ fontSize: 10, padding: "2px 7px", flexShrink: 0 }}
        title="Edytuj adres inwestycji"
      >
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
        Edytuj
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "5px 8px",
  border: "1px solid var(--line)",
  borderRadius: 5,
  background: "var(--panel-2)",
  color: "var(--text)",
  fontFamily: "inherit",
  width: "100%",
  outline: "none",
};
