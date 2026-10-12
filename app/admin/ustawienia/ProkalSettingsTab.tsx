"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Pencil,
  X,
  Sparkles,
  Search,
} from "lucide-react";

export function ProkalSettingsTab() {
  const components = useQuery(api.prokal.listComponents, {}) ?? [];
  const systems = useQuery(api.prokal.listSystems, {}) ?? [];
  const saveComponentMutation = useMutation(api.prokal.saveComponent);
  const deleteComponentMutation = useMutation(api.prokal.deleteComponent);
  const saveSystemMutation = useMutation(api.prokal.saveSystem);
  const deleteSystemMutation = useMutation(api.prokal.deleteSystem);
  const seedMutation = useMutation(api.prokal.seedDefaultProkalData);

  const [activeSubTab, setActiveSubTab] = useState<"components" | "systems">("components");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isSeeding, setIsSeeding] = useState(false);

  // Stan modala edycji komponentu
  const [editingComponent, setEditingComponent] = useState<{
    id?: Id<"prokalComponents">;
    code: string;
    name: string;
    category:
      | "profile_upper"
      | "profile_lower"
      | "profile_side"
      | "profile_sash"
      | "glass"
      | "hardware"
      | "gasket"
      | "accessory";
    unit: "mb" | "m2" | "szt" | "kpl";
    priceCostNet: number;
    priceClientNet: number;
    weightPerUnit: number;
    tracksCount?: number;
    color?: string;
    producer?: string;
    description?: string;
    isActive: boolean;
  } | null>(null);

  // Stan modala edycji systemu
  const [editingSystem, setEditingSystem] = useState<{
    id?: Id<"prokalSystems">;
    key: string;
    name: string;
    tracksCount: number;
    defaultSashesCount: number;
    producer: string;
    description?: string;
    glassOverlapMm: number;
    heightDeductionMm: number;
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
    maxSashWeightKg: number;
    isActive: boolean;
  } | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedMutation();
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComponent) return;
    try {
      await saveComponentMutation(editingComponent);
      setEditingComponent(null);
    } catch (err) {
      alert("Błąd zapisu komponentu: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSystem) return;
    try {
      await saveSystemMutation({
        ...editingSystem,
        componentAssignments: [
          { role: "top_rail", defaultCode: "5448 7016MAT", multiplier: 1 },
          { role: "bottom_rail", defaultCode: "5450 7016MAT", multiplier: 1 },
          { role: "side_frame", defaultCode: "5450 7016MAT (Bok)", multiplier: 2 },
          { role: "sash_bottom_profile", defaultCode: "5452 7016MAT", multiplier: 1 },
          { role: "glass", defaultCode: "HART 10", multiplier: 1 },
          { role: "rollers", defaultCode: "WOZ-PROCURAL", multiplier: 2 },
        ],
      });
      setEditingSystem(null);
    } catch (err) {
      alert("Błąd zapisu systemu: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const filteredComponents = components.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.producer && c.producer.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Nagłówek modułu */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#0284C715",
              color: "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>
              Konfigurator PROKAL — Komponenty i Systemy Przesuwne
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "3px 0 0 0" }}>
              Zarządzanie profilami aluminiowymi, formatkami szkła, okuciami, wózkami i szablonami systemów wielotorowych.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={handleSeed}
            disabled={isSeeding}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <Sparkles size={14} color="#0284C7" />
            {isSeeding ? "Inicjalizacja..." : "Zasiej wzorce PROKAL"}
          </button>

          {activeSubTab === "components" ? (
            <button
              type="button"
              onClick={() =>
                setEditingComponent({
                  code: "",
                  name: "",
                  category: "profile_upper",
                  unit: "mb",
                  priceCostNet: 0,
                  priceClientNet: 0,
                  weightPerUnit: 0,
                  color: "RAL 7016MAT",
                  producer: "PROCURAL",
                  isActive: true,
                })
              }
              className="btn primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
            >
              <Plus size={15} />
              + Nowy komponent
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setEditingSystem({
                  key: `SLIDING_${systems.length + 2}_TRACK`,
                  name: `System przesuwny ${systems.length + 2}-torowy`,
                  tracksCount: systems.length + 2,
                  defaultSashesCount: systems.length + 2,
                  producer: "PROCURAL",
                  glassOverlapMm: 25,
                  heightDeductionMm: 103,
                  minWidthMm: 1500,
                  maxWidthMm: 6000,
                  minHeightMm: 1500,
                  maxHeightMm: 2600,
                  maxSashWeightKg: 70,
                  isActive: true,
                })
              }
              className="btn primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
            >
              <Plus size={15} />
              + Nowy system przesuwny
            </button>
          )}
        </div>
      </div>

      {/* Przełącznik podzakładek */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--line)", gap: 8 }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("components")}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: activeSubTab === "components" ? 700 : 500,
            color: activeSubTab === "components" ? "var(--accent)" : "var(--text-mute)",
            borderBottom: activeSubTab === "components" ? "2px solid var(--accent)" : "2px solid transparent",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
          }}
        >
          Komponenty i Artykuły ({components.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("systems")}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: activeSubTab === "systems" ? 700 : 500,
            color: activeSubTab === "systems" ? "var(--accent)" : "var(--text-mute)",
            borderBottom: activeSubTab === "systems" ? "2px solid var(--accent)" : "2px solid transparent",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
          }}
        >
          Systemy Przesuwne (2-, 3-, 4-, 5-torowe) ({systems.length})
        </button>
      </div>

      {/* ── 1. PODZAKŁADKA: KOMPONENTY ── */}
      {activeSubTab === "components" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Pasek wyszukiwania i filtrów */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-mute)" }} />
              <input
                type="text"
                placeholder="Szukaj po kodzie, nazwie lub producencie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  color: "var(--text)",
                  fontSize: 12.5,
                }}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--panel)",
                color: "var(--text)",
                fontSize: 12.5,
              }}
            >
              <option value="all">Wszystkie kategorie</option>
              <option value="profile_upper">Profile ramy górne</option>
              <option value="profile_lower">Profile toru dolnego</option>
              <option value="profile_side">Profile boczne ramy</option>
              <option value="profile_sash">Profile skrzydła (zaciskowe)</option>
              <option value="glass">Szkło / Wypełnienia</option>
              <option value="hardware">Okucia i wózki</option>
              <option value="gasket">Uszczelnienia i szczotki</option>
              <option value="accessory">Akcesoria / zamki</option>
            </select>
          </div>

          {/* Tabela komponentów */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)" }}>Kod</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)" }}>Nazwa komponentu</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)" }}>Kategoria</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)" }}>J.m.</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)", textAlign: "right" }}>Koszt netto</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)", textAlign: "right" }}>Cena klienta netto</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)", textAlign: "right" }}>Waga jedn.</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)" }}>Producent / Kolor</th>
                  <th style={{ padding: "10px 12px", color: "var(--text-mute)", textAlign: "center" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--text-mute)" }}>
                      Brak komponentów spełniających kryteria.
                    </td>
                  </tr>
                ) : (
                  filteredComponents.map((comp) => (
                    <tr
                      key={comp._id}
                      style={{
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-strong)" }}>
                        {comp.code}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text)" }}>{comp.name}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-mute)", fontSize: 11 }}>
                        <span
                          style={{
                            background: "#0284C715",
                            color: "#0284C7",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {comp.category}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-mute)" }}>{comp.unit}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-mute)" }}>
                        {comp.priceCostNet.toLocaleString("pl-PL")} zł
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-strong)" }}>
                        {comp.priceClientNet.toLocaleString("pl-PL")} zł
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-mute)" }}>
                        {comp.weightPerUnit} kg/{comp.unit}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-mute)", fontSize: 11.5 }}>
                        {[comp.producer, comp.color].filter(Boolean).join(" • ") || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingComponent({
                                id: comp._id,
                                code: comp.code,
                                name: comp.name,
                                category: comp.category,
                                unit: comp.unit,
                                priceCostNet: comp.priceCostNet,
                                priceClientNet: comp.priceClientNet,
                                weightPerUnit: comp.weightPerUnit,
                                color: comp.color,
                                producer: comp.producer,
                                description: comp.description,
                                isActive: comp.isActive,
                              })
                            }
                            title="Edytuj"
                            style={{
                              padding: 4,
                              background: "none",
                              border: "none",
                              color: "var(--text-mute)",
                              cursor: "pointer",
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Czy na pewno usunąć komponent "${comp.name}"?`)) {
                                await deleteComponentMutation({ id: comp._id });
                              }
                            }}
                            title="Usuń"
                            style={{
                              padding: 4,
                              background: "none",
                              border: "none",
                              color: "#DC2626",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. PODZAKŁADKA: SYSTEMY PRZESUWNE ── */}
      {activeSubTab === "systems" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {systems.map((sys) => (
            <div
              key={sys._id}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span
                    style={{
                      background: "#0284C715",
                      color: "#0284C7",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {sys.tracksCount}-TOROWY
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-mute)" }}>{sys.producer}</span>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 6px 0" }}>
                  {sys.name}
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-mute)", margin: 0 }}>
                  {sys.description || "System całoszklanych ścian przesuwnych"}
                </p>

                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 8,
                    background: "var(--card)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    fontSize: 11,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-mute)", display: "block" }}>Luz pionowy:</span>
                    <strong style={{ color: "var(--text-strong)" }}>{sys.heightDeductionMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-mute)", display: "block" }}>Zakładka tafli:</span>
                    <strong style={{ color: "var(--text-strong)" }}>{sys.glassOverlapMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-mute)", display: "block" }}>Max szerokość:</span>
                    <strong style={{ color: "var(--text-strong)" }}>{sys.maxWidthMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-mute)", display: "block" }}>Max nośność wózka:</span>
                    <strong style={{ color: "var(--text-strong)" }}>{sys.maxSashWeightKg} kg</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setEditingSystem({
                      id: sys._id,
                      key: sys.key,
                      name: sys.name,
                      tracksCount: sys.tracksCount,
                      defaultSashesCount: sys.defaultSashesCount,
                      producer: sys.producer,
                      description: sys.description,
                      glassOverlapMm: sys.glassOverlapMm,
                      heightDeductionMm: sys.heightDeductionMm,
                      minWidthMm: sys.minWidthMm,
                      maxWidthMm: sys.maxWidthMm,
                      minHeightMm: sys.minHeightMm,
                      maxHeightMm: sys.maxHeightMm,
                      maxSashWeightKg: sys.maxSashWeightKg,
                      isActive: sys.isActive,
                    })
                  }
                  className="btn"
                  style={{ fontSize: 11.5, padding: "4px 10px" }}
                >
                  <Pencil size={13} />
                  Edytuj parametry
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Czy na pewno chcesz usunąć system "${sys.name}"?`)) {
                      await deleteSystemMutation({ id: sys._id });
                    }
                  }}
                  className="btn"
                  style={{ fontSize: 11.5, padding: "4px 8px", color: "#DC2626" }}
                  title="Usuń system"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL EDYCJI KOMPONENTU ── */}
      {editingComponent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setEditingComponent(null)}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>
                {editingComponent.id ? "Edycja komponentu" : "Nowy komponent PROKAL"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingComponent(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveComponent} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Kod artykułu *:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingComponent.code}
                    onChange={(e) => setEditingComponent({ ...editingComponent, code: e.target.value })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                    placeholder="np. 5448 7016MAT"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Kategoria *:
                  </label>
                  <select
                    value={editingComponent.category}
                    onChange={(e) =>
                      setEditingComponent({
                        ...editingComponent,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        category: e.target.value as any,
                      })
                    }
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  >
                    <option value="profile_upper">Profil ramy górny</option>
                    <option value="profile_lower">Profil toru dolnego</option>
                    <option value="profile_side">Profil boczny ramy</option>
                    <option value="profile_sash">Profil skrzydła</option>
                    <option value="glass">Szkło / Wypełnienie</option>
                    <option value="hardware">Okucia / wózki</option>
                    <option value="gasket">Uszczelki</option>
                    <option value="accessory">Akcesoria</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                  Pełna nazwa komponentu *:
                </label>
                <input
                  type="text"
                  required
                  value={editingComponent.name}
                  onChange={(e) => setEditingComponent({ ...editingComponent, name: e.target.value })}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  placeholder="np. Profil toru górnego jezdnego 3-torowy"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Jednostka:
                  </label>
                  <select
                    value={editingComponent.unit}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setEditingComponent({ ...editingComponent, unit: e.target.value as any })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  >
                    <option value="mb">mb</option>
                    <option value="m2">m2</option>
                    <option value="szt">szt</option>
                    <option value="kpl">kpl</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Koszt zakupu (zł):
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={editingComponent.priceCostNet}
                    onChange={(e) => setEditingComponent({ ...editingComponent, priceCostNet: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Cena klienta (zł):
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={editingComponent.priceClientNet}
                    onChange={(e) => setEditingComponent({ ...editingComponent, priceClientNet: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Waga na jednostkę (kg):
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingComponent.weightPerUnit}
                    onChange={(e) => setEditingComponent({ ...editingComponent, weightPerUnit: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Producent:
                  </label>
                  <input
                    type="text"
                    value={editingComponent.producer || ""}
                    onChange={(e) => setEditingComponent({ ...editingComponent, producer: e.target.value })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                    placeholder="np. PROCURAL"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setEditingComponent(null)}
                  className="btn"
                  style={{ fontSize: 12 }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{ fontSize: 12 }}
                >
                  Zapisz komponent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDYCJI SYSTEMU ── */}
      {editingSystem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setEditingSystem(null)}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>
                {editingSystem.id ? "Edycja systemu przesuwnego" : "Nowy system przesuwny PROKAL"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSystem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSystem} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Nazwa systemu *:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSystem.name}
                    onChange={(e) => setEditingSystem({ ...editingSystem, name: e.target.value })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Liczba torów jezdnych:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={editingSystem.tracksCount}
                    onChange={(e) => setEditingSystem({ ...editingSystem, tracksCount: parseInt(e.target.value) || 3 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Luz redukcji pionowej (mm):
                  </label>
                  <input
                    type="number"
                    value={editingSystem.heightDeductionMm}
                    onChange={(e) => setEditingSystem({ ...editingSystem, heightDeductionMm: parseInt(e.target.value) || 103 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                    placeholder="103"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Zakładka skrzydeł (mm):
                  </label>
                  <input
                    type="number"
                    value={editingSystem.glassOverlapMm}
                    onChange={(e) => setEditingSystem({ ...editingSystem, glassOverlapMm: parseInt(e.target.value) || 25 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                    placeholder="25"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Max szerokość ramy (mm):
                  </label>
                  <input
                    type="number"
                    value={editingSystem.maxWidthMm}
                    onChange={(e) => setEditingSystem({ ...editingSystem, maxWidthMm: parseInt(e.target.value) || 6000 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-mute)", marginBottom: 3 }}>
                    Max nośność wózka (kg):
                  </label>
                  <input
                    type="number"
                    value={editingSystem.maxSashWeightKg}
                    onChange={(e) => setEditingSystem({ ...editingSystem, maxSashWeightKg: parseInt(e.target.value) || 70 })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setEditingSystem(null)}
                  className="btn"
                  style={{ fontSize: 12 }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{ fontSize: 12 }}
                >
                  Zapisz system
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
