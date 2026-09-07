"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  Sparkles,
  Layers,
  Save,
  RotateCcw,
  Check,
  Loader2,
  Plus,
  Key,
  Bot,
  Eye,
  EyeOff,
} from "lucide-react";

export default function AsystentWycenSettingsPage() {
  const [activeTab, setActiveTab] = useState<"polycarbonate" | "glass">("polycarbonate");
  const [filterWidth, setFilterWidth] = useState<number | "all">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ priceGross: number; priceNet: number }>({
    priceGross: 0,
    priceNet: 0,
  });

  // Stan dla konfiguracji AI
  const aiConfig = useQuery(api.aiAssistant.getAiConfig);
  const saveAiConfigMutation = useMutation(api.aiAssistant.saveAiConfig);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<
    "claude-3-5-sonnet-20241022" | "claude-3-5-haiku-20241022"
  >("claude-3-5-sonnet-20241022");
  const [systemPromptExtra, setSystemPromptExtra] = useState("");
  const [isSavingAi, setIsSavingAi] = useState(false);

  useEffect(() => {
    if (aiConfig) {
      setSelectedModel(aiConfig.selectedModel || "claude-3-5-sonnet-20241022");
      setSystemPromptExtra(aiConfig.systemPromptExtra || "");
    }
  }, [aiConfig]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const prices = useQuery(api.terracePricing.listTerracePrices, { material: activeTab });
  const upsertPrice = useMutation(api.terracePricing.upsertTerracePrice);
  const seedPrices = useMutation(api.terracePricing.seedDefaultTerracePrices);

  const filteredPrices = (prices ?? []).filter((p) =>
    filterWidth === "all" ? true : p.widthCm === filterWidth
  );

  // Sortuj po szerokości i długości
  filteredPrices.sort((a, b) => {
    if (a.widthCm !== b.widthCm) return a.widthCm - b.widthCm;
    return a.lengthCm - b.lengthCm;
  });

  const handleEdit = (item: { widthCm: number; lengthCm: number; priceGross: number; priceNet: number }) => {
    const key = `${item.widthCm}x${item.lengthCm}`;
    setEditingKey(key);
    setEditForm({ priceGross: item.priceGross, priceNet: item.priceNet });
  };

  const handleSave = async (widthCm: number, lengthCm: number) => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await upsertPrice({
        material: activeTab,
        widthCm,
        lengthCm,
        priceGross: Number(editForm.priceGross),
        priceNet: Number(editForm.priceNet),
      });
      setEditingKey(null);
      setStatusMsg({ type: "success", text: `Zapisano cenę dla ${widthCm}x${lengthCm} cm.` });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: `Błąd podczas zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeed = async (overwrite: boolean = false) => {
    setIsSeeding(true);
    setStatusMsg(null);
    try {
      const res = await seedPrices({ overwrite });
      setStatusMsg({ type: "success", text: res.message });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: `Błąd zasilania danych: ${err instanceof Error ? err.message : "Nieznany błąd"}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveAiConfig = async () => {
    setIsSavingAi(true);
    setStatusMsg(null);
    try {
      await saveAiConfigMutation({
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        selectedModel,
        systemPromptExtra: systemPromptExtra.trim(),
      });
      setApiKeyInput("");
      setStatusMsg({ type: "success", text: "Zapisano konfigurację Anthropic Claude AI!" });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: `Błąd zapisu konfiguracji AI: ${err instanceof Error ? err.message : "Nieznany błąd"}`,
      });
    } finally {
      setIsSavingAi(false);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Powrót do czatu wycen */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/wycena"
          className="btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            padding: "6px 12px",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Powrót do Asystenta Wycen
        </Link>
      </div>

      {/* Nagłówek strony */}
      <div
        className="panel"
        style={{
          padding: 24,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <Settings size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text-strong)" }}>
              Ustawienia Asystenta Wycen
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0" }}>
              Konfiguracja modelu Anthropic Claude AI oraz cenniki dystrybutora dla zadaszeń tarasowych
            </p>
          </div>
        </div>

        {/* Akcje zasilania */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn"
            onClick={() => handleSeed(true)}
            disabled={isSeeding}
            style={{ fontSize: 12 }}
            title="Przeładuj i nadpisz cennik domyślnymi danymi katalogowymi"
          >
            {isSeeding ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
            Przeładuj cennik fabryczny
          </button>
        </div>
      </div>

      {/* Komunikat statusu */}
      {statusMsg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            background: statusMsg.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${statusMsg.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: statusMsg.type === "success" ? "#10b981" : "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── KARTA KONFIGURACJI CLAUDE AI ── */}
      <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Bot size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-strong)" }}>
            Połączenie z API Anthropic Claude
          </h2>
          {aiConfig?.hasApiKey ? (
            <span className="pill ok" style={{ fontSize: 11, padding: "2px 8px" }}>
              Klucz skonfigurowany ({aiConfig.apiKeyMasked})
            </span>
          ) : (
            <span className="pill bad" style={{ fontSize: 11, padding: "2px 8px" }}>
              Brak klucza API
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Klucz API */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>
              Anthropic API Key (sk-ant-...)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showApiKey ? "text" : "password"}
                placeholder={aiConfig?.hasApiKey ? "Pozostaw puste aby zachować obecny klucz" : "Wklej klucz sk-ant-api03-..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 36px 8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  fontSize: 13,
                  color: "var(--text)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-mute)",
                }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-mute)", margin: "4px 0 0" }}>
              Klucz przetrzymywany bezpiecznie w bazie Convex. Generowany na platformie Anthropic Console.
            </p>
          </div>

          {/* Wybór Modelu */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>
              Model sztucznej inteligencji
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as any)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                fontSize: 13,
                color: "var(--text)",
              }}
            >
              <option value="claude-3-5-sonnet-20241022">
                Claude 3.5 Sonnet (Rekomendowany: Najwyższa precyzja i jakość kalkulacji)
              </option>
              <option value="claude-3-5-haiku-20241022">
                Claude 3.5 Haiku (Szybki i ekonomiczny)
              </option>
            </select>
            <p style={{ fontSize: 11, color: "var(--text-mute)", margin: "4px 0 0" }}>
              Model Sonnet rekomendowany jest do automatycznego parsowania wymiarów i wycen.
            </p>
          </div>
        </div>

        {/* Dodatkowe instrukcje promptu */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>
            Dodatkowe wytyczne dla AI (Opcjonalne)
          </label>
          <textarea
            rows={2}
            placeholder="np. Zawsze oferuj montaż 1500 zł netto przy wycenach zadaszenia. Proponuj rabat 5% przy zamówieniu powyżej 15 000 zł..."
            value={systemPromptExtra}
            onChange={(e) => setSystemPromptExtra(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              fontSize: 13,
              color: "var(--text)",
              resize: "vertical",
            }}
          />
        </div>

        {/* Zapisał */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn primary"
            onClick={handleSaveAiConfig}
            disabled={isSavingAi}
            style={{ padding: "8px 18px" }}
          >
            {isSavingAi ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            Zapisz konfigurację AI
          </button>
        </div>
      </div>

      {/* Zakładki materiałów */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => {
            setActiveTab("polycarbonate");
            setEditingKey(null);
          }}
          className={`btn ${activeTab === "polycarbonate" ? "primary" : ""}`}
          style={{ padding: "10px 18px", borderRadius: 8, fontSize: 14 }}
        >
          <Layers size={16} /> Dach z Poliwęglanu
        </button>
        <button
          onClick={() => {
            setActiveTab("glass");
            setEditingKey(null);
          }}
          className={`btn ${activeTab === "glass" ? "primary" : ""}`}
          style={{ padding: "10px 18px", borderRadius: 8, fontSize: 14 }}
        >
          <Sparkles size={16} /> Zadaszenie Szkło
        </button>
      </div>

      {/* Filtry i Statystyki */}
      <div
        className="panel"
        style={{
          padding: 16,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
            Filtruj szerokość (od ściany do słupa):
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "Wszystkie", value: "all" },
              { label: "300 cm", value: 300 },
              { label: "350 cm", value: 350 },
              { label: "400 cm", value: 400 },
            ].map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setFilterWidth(f.value as any)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: filterWidth === f.value ? 600 : 400,
                  border: "1px solid var(--line)",
                  background: filterWidth === f.value ? "var(--accent-soft)" : "transparent",
                  color: filterWidth === f.value ? "var(--accent)" : "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-mute)" }}>
          Liczba pozycji: <strong style={{ color: "var(--text-strong)" }}>{filteredPrices.length}</strong>
        </div>
      </div>

      {/* Tabela Cennika */}
      <div className="panel" style={{ overflow: "hidden" }}>
        {prices === undefined ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-mute)" }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
            Ładowanie cennika...
          </div>
        ) : filteredPrices.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "var(--text-mute)", margin: "0 0 16px" }}>
              Brak zdefiniowanych cen dla wybranego materiału / filtra.
            </p>
            <button className="btn primary" onClick={() => handleSeed(false)}>
              Zasil domyślnym cennikiem
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--panel-2)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Szerokość (od ściany do słupa)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Długość (wzdłuż ściany)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Cena Brutto (zł)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Cena Netto (zł)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrices.map((item) => {
                const key = `${item.widthCm}x${item.lengthCm}`;
                const isEditing = editingKey === key;

                return (
                  <tr
                    key={item._id}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      background: isEditing ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>{item.widthCm} cm</td>
                    <td style={{ padding: "10px 16px" }}>{item.lengthCm} cm</td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.priceGross}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, priceGross: Number(e.target.value) }))
                          }
                          style={{
                            width: 120,
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--accent-line)",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {item.priceGross.toLocaleString("pl-PL")} zł
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.priceNet}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, priceNet: Number(e.target.value) }))
                          }
                          style={{
                            width: 120,
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--accent-line)",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span className="mono" style={{ color: "var(--text-dim)" }}>
                          {item.priceNet.toLocaleString("pl-PL")} zł
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn primary"
                            onClick={() => handleSave(item.widthCm, item.lengthCm)}
                            disabled={isSaving}
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            {isSaving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                            Zapisz
                          </button>
                          <button
                            className="btn"
                            onClick={() => setEditingKey(null)}
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            Anuluj
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => handleEdit(item)}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          Edytuj
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
