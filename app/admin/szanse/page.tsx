"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { CrmPageHeader, CrmEmptyState, fmtDate, fmtPLN } from "@/components/crm-ui";
import { Plus, Search, X, Archive, ArchiveRestore } from "lucide-react";

type Stage = "lead" | "inquiry";

const STAGE_LABELS: Record<Stage, string> = {
  lead: "Oferty",
  inquiry: "Oferta wysłana",
};

const STAGE_COLORS: Record<Stage, { bg: string; text: string }> = {
  lead: { bg: "#fef3c7", text: "#b45309" },
  inquiry: { bg: "#dbeafe", text: "#1d4ed8" },
};

export default function SzansePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("fromTab");
  const backHref = fromTab ? `/admin/panel?tab=${fromTab}` : "/admin/panel";

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [showArchived, setShowArchived] = useState(false);

  const opportunities = useQuery(api.salesOpportunities.listOpportunities, {
    includeArchived: showArchived,
  });

  const filtered = useMemo(() => {
    if (!opportunities) return [];
    let list = opportunities;

    // Stage filter
    if (stageFilter !== "all") {
      list = list.filter((o) => (o.stage ?? "lead") === stageFilter);
    }

    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((o) => {
        const name = `${o.firstName} ${o.lastName}`.toLowerCase();
        const city = (o.investmentCity || o.city || "").toLowerCase();
        const email = (o.email || "").toLowerCase();
        const phone = (o.phone || "").toLowerCase();
        const services = (o.services || []).join(" ").toLowerCase();
        return (
          name.includes(q) ||
          city.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          services.includes(q)
        );
      });
    }

    return list;
  }, [opportunities, stageFilter, searchTerm]);

  const counts = useMemo(() => {
    if (!opportunities) return { all: 0, lead: 0, inquiry: 0 };
    return {
      all: opportunities.length,
      lead: opportunities.filter((o) => (o.stage ?? "lead") === "lead").length,
      inquiry: opportunities.filter((o) => o.stage === "inquiry").length,
    };
  }, [opportunities]);

  const loading = opportunities === undefined;

  return (
    <div>
      <CrmPageHeader
        title="Szanse sprzedaży"
        sub="Przegląd wszystkich szans sprzedaży (leadów i ofert)."
        backHref={backHref}
        backLabel="Powrót do Panelu"
        center={
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-mute)" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Wyszukaj szansę..."
              style={{
                width: "100%",
                padding: "8px 30px 8px 34px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "var(--text-strong)",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "var(--panel-3)", border: "none", borderRadius: "50%",
                  cursor: "pointer", color: "var(--text-mute)", width: 20, height: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        }
        actions={
          <>
            <button
              className="btn"
              onClick={() => setShowArchived((v) => !v)}
              style={{ background: showArchived ? "var(--panel-3)" : undefined }}
            >
              {showArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {showArchived ? "Ukryj archiwum" : "Pokaż archiwum"}
            </button>
            <Link href="/admin/szansa/nowa" className="btn primary" style={{ textDecoration: "none" }}>
              <Plus size={13} /> Nowa szansa
            </Link>
          </>
        }
      />

      {/* Stage filter tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
        {(["all", "lead", "inquiry"] as const).map((key) => {
          const label = key === "all" ? "Wszystkie" : STAGE_LABELS[key];
          const count = counts[key];
          const active = stageFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStageFilter(key)}
              style={{
                padding: "5px 11px",
                fontSize: 11.5,
                borderRadius: 4,
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-mute)",
                border: "1px solid",
                borderColor: active ? "var(--accent-line)" : "transparent",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              {label}
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: "0px 5px", borderRadius: 999,
                background: active ? "var(--accent)" : "var(--panel-3)",
                color: active ? "#fff" : "var(--text-mute)",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="panel" style={{ padding: "40px 20px", textAlign: "center" }}>
          <span className="mute" style={{ fontSize: 12.5 }}>Ładowanie…</span>
        </div>
      ) : filtered.length === 0 ? (
        <CrmEmptyState message={searchTerm ? "Brak wyników wyszukiwania." : "Brak szans sprzedaży."} />
      ) : (
        <div className="panel" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={TH}>Klient</th>
                <th style={TH}>Miasto</th>
                <th style={TH}>Usługi</th>
                <th style={TH}>Etap</th>
                <th style={TH}>Opiekun</th>
                <th style={{ ...TH, textAlign: "right" }}>Cena</th>
                <th style={TH}>Utworzono</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => {
                const stage = (opp.stage ?? "lead") as Stage;
                const stageColor = STAGE_COLORS[stage];
                const clientName = `${opp.firstName} ${opp.lastName}`.trim() || "—";
                const city = opp.investmentCity || opp.city || "—";
                const services = opp.services ?? [];

                return (
                  <tr
                    key={opp._id}
                    onClick={() => router.push(`/admin/szansa/${opp._id}`)}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td style={TD}>
                      <div style={{ fontWeight: 600, color: "var(--text-strong)" }}>
                        {clientName}
                      </div>
                      {opp.email && (
                        <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 1 }}>
                          {opp.email}
                        </div>
                      )}
                    </td>
                    <td style={TD}>
                      <span style={{ color: "var(--text-dim)" }}>{city}</span>
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {services.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            style={{
                              fontSize: 10, fontWeight: 600,
                              background: "#f1f5f9", color: "#475569",
                              borderRadius: 3, padding: "1px 6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                        {services.length > 2 && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>
                            +{services.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600,
                        background: stageColor.bg, color: stageColor.text,
                        borderRadius: 3, padding: "2px 7px",
                        whiteSpace: "nowrap",
                      }}>
                        {STAGE_LABELS[stage]}
                      </span>
                    </td>
                    <td style={TD}>
                      {opp.assignees && opp.assignees.length > 0 ? (
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {opp.assignees.slice(0, 2).map((a) => (
                            <span
                              key={a.id}
                              title={a.name ?? undefined}
                              style={{
                                width: 22, height: 22,
                                borderRadius: "50%",
                                background: a.color || "#6366f1",
                                color: "#fff",
                                fontSize: 9, fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {(a.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                          ))}
                          {opp.assignees.length > 2 && (
                            <span style={{ fontSize: 10, color: "var(--text-mute)" }}>
                              +{opp.assignees.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-mute)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {opp.price != null ? (
                        <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>
                          {fmtPLN(opp.price)} zł
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-mute)" }}>—</span>
                      )}
                    </td>
                    <td style={TD}>
                      <span style={{ color: "var(--text-dim)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                        {fmtDate(opp._creationTime)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--text-mute)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 10px",
  verticalAlign: "middle",
};
