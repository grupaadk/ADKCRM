"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const MANUFACTURERS = [
  { label: "WIKĘD (Drzwi zewnętrzne)", manufacturer: "WIKĘD", type: "Drzwi zewnętrzne" },
  { label: "ABAKUS / Salamander (Okna PCV)", manufacturer: "ABAKUS / Salamander", type: "Okna PCV" },
  { label: "ABM Jędraszek / VEKA (Okna PCV)", manufacturer: "ABM Jędraszek / VEKA", type: "Okna PCV" },
  { label: "KS System (Brama garażowa)", manufacturer: "KS System", type: "Brama garażowa" },
  { label: "Wiśniowski (Brama garażowa)", manufacturer: "Wiśniowski", type: "Brama garażowa" },
  { label: "Inny", manufacturer: "", type: "" },
] as const;

export default function WarrantyCardUpload({
  orderId,
}: {
  orderId: Id<"orders">;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customManufacturer, setCustomManufacturer] = useState("");
  const [type, setType] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addWarrantyCard = useMutation(api.orders.addWarrantyCard);

  function reset() {
    setSelectedIndex(null);
    setCustomManufacturer("");
    setType("");
    setFileUrl("");
    setSubmitting(false);
  }

  function handleCancel() {
    reset();
    setIsOpen(false);
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = e.target.value === "" ? null : Number(e.target.value);
    setSelectedIndex(idx);
    if (idx !== null) {
      const m = MANUFACTURERS[idx];
      if (m.label === "Inny") {
        setCustomManufacturer("");
        setType("");
      } else {
        setCustomManufacturer("");
        setType(m.type);
      }
    } else {
      setType("");
    }
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();

    const isCustom = selectedIndex !== null && MANUFACTURERS[selectedIndex].label === "Inny";
    const manufacturer = isCustom
      ? customManufacturer.trim()
      : selectedIndex !== null
        ? MANUFACTURERS[selectedIndex].manufacturer
        : "";

    if (!manufacturer || !type.trim() || !fileUrl.trim()) return;

    setSubmitting(true);
    try {
      await addWarrantyCard({
        orderId,
        manufacturer,
        type: type.trim(),
        fileUrl: fileUrl.trim(),
      });
      reset();
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to add warranty card:", err);
      setSubmitting(false);
    }
  }

  const isCustom = selectedIndex !== null && MANUFACTURERS[selectedIndex].label === "Inny";
  const manufacturer = isCustom
    ? customManufacturer.trim()
    : selectedIndex !== null
      ? MANUFACTURERS[selectedIndex].manufacturer
      : "";
  const canSubmit = manufacturer.length > 0 && type.trim().length > 0 && fileUrl.trim().length > 0 && !submitting;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 border border-dashed border-slate-300 rounded-md py-2 hover:border-blue-400 transition-colors"
      >
        + Dodaj kartę gwarancyjną
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 border border-slate-200 rounded-md p-4 bg-slate-50">
      {/* Producent */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Producent
        </label>
        <select
          value={selectedIndex === null ? "" : String(selectedIndex)}
          onChange={handleSelectChange}
          className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">Wybierz producenta...</option>
          {MANUFACTURERS.map((m, i) => (
            <option key={m.label} value={String(i)}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom manufacturer input */}
      {isCustom && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Nazwa producenta
          </label>
          <input
            type="text"
            value={customManufacturer}
            onChange={(e) => setCustomManufacturer(e.target.value)}
            placeholder="Wpisz nazwę producenta"
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      )}

      {/* Typ */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Typ
        </label>
        <input
          type="text"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="np. Okna PCV, Drzwi zewnętrzne..."
          className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* URL pliku */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          URL pliku (Google Drive)
        </label>
        <input
          type="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Dodawanie..." : "Dodaj"}
        </button>
      </div>
    </form>
  );
}
