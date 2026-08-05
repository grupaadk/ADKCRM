"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { CrmPageHeader } from "@/components/crm-ui";
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  UserCheck,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Search,
  X,
  Key,
} from "lucide-react";

const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

interface TeamFormData {
  name: string;
  color: string;
  leaderName: string;
  phone: string;
  membersText: string;
  pin: string;
  isActive: boolean;
}

const defaultForm = (): TeamFormData => ({
  name: "",
  color: PRESET_COLORS[0],
  leaderName: "",
  phone: "",
  membersText: "",
  pin: "",
  isActive: true,
});

export default function EkipyPage() {
  const teams = useQuery(api.installationTeams.listAllWithStats) ?? [];
  const createTeam = useMutation(api.installationTeams.create);
  const updateTeam = useMutation(api.installationTeams.update);
  const deleteTeam = useMutation(api.installationTeams.remove);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"installationTeams"> | null>(null);
  const [form, setForm] = useState<TeamFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (team: typeof teams[0]) => {
    setForm({
      name: team.name,
      color: team.color ?? PRESET_COLORS[0],
      leaderName: team.leaderName ?? "",
      phone: team.phone ?? "",
      membersText: team.members ? team.members.join(", ") : "",
      pin: team.pin ?? "",
      isActive: team.isActive,
    });
    setEditingId(team._id);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Podaj nazwę ekipy montażowej.");
      return;
    }

    const cleanPin = form.pin.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      setError("PIN do aplikacji mobilnej musi składać się z 4 cyfr.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const members = form.membersText
        ? form.membersText.split(",").map((m) => m.trim()).filter(Boolean)
        : undefined;

      if (editingId) {
        await updateTeam({
          id: editingId,
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      } else {
        await createTeam({
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      }
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Błąd zapisywania ekipy.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"installationTeams">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ekipę "${name}"?`)) return;
    try {
      await deleteTeam({ id });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Nie udało się usunąć ekipy.");
    }
  };

  // Filtered teams
  const filteredTeams = teams.filter((t) => {
    if (filterStatus === "active" && !t.isActive) return false;
    if (filterStatus === "inactive" && t.isActive) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchName = t.name.toLowerCase().includes(term);
      const matchLeader = (t.leaderName ?? "").toLowerCase().includes(term);
      const matchPhone = (t.phone ?? "").toLowerCase().includes(term);
      const matchMember = t.members?.some((m) => m.toLowerCase().includes(term));
      if (!matchName && !matchLeader && !matchPhone && !matchMember) return false;
    }
    return true;
  });

  const totalActive = teams.filter((t) => t.isActive).length;
  const totalUpcoming = teams.reduce((acc, t) => acc + (t.upcomingInstallationsCount ?? 0), 0);
  const totalOpenComplaints = teams.reduce((acc, t) => acc + (t.openComplaintsCount ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <CrmPageHeader
        title="Ekipy montażowe"
        sub="Zarządzaj zespołami monterskimi, śledź ich przydzielone montaże, finanse i serwisy."
        center={
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-mute)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj ekipy, kierownika, montera..."
              style={{
                width: "100%",
                padding: "8px 30px 8px 34px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: "var(--card)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-strong)",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)", padding: 2,
                }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
        }
        actions={
          <button
            onClick={openCreate}
            className="btn primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Dodaj ekipę
          </button>
        }
        tabs={[
          { key: "all", label: "Wszystkie", count: teams.length },
          { key: "active", label: "Aktywne", count: totalActive },
          { key: "inactive", label: "Nieaktywne", count: teams.length - totalActive },
        ]}
        activeTab={filterStatus}
        onTab={(k) => setFilterStatus(k as "all" | "active" | "inactive")}
      />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#ecfdf5", color: "#10b981",
            display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: 700, flexShrink: 0,
          }}>
            <UserCheck style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>{totalActive}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Aktywne ekipy
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#eff6ff", color: "#3b82f6",
            display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: 700, flexShrink: 0,
          }}>
            <Calendar style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>{totalUpcoming}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Zaplanowane montaże
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#fffbeb", color: "#f59e0b",
            display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: 700, flexShrink: 0,
          }}>
            <AlertTriangle style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>{totalOpenComplaints}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Otwarte serwisy
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal / Drawer */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(2px)",
          zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 24,
            width: "100%", maxWidth: 540, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                {editingId ? "Edytuj ekipę montażową" : "Nowa ekipa montażowa"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", fontSize: 12.5, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Nazwa ekipy <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="np. Ekipa Alfa - Jan Kowalski"
                    required
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Kolor ekipy w kalendarzu
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", backgroundColor: form.color, flexShrink: 0 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, color: c }))}
                          style={{
                            width: 24, height: 24, borderRadius: "50%", border: form.color === c ? "2px solid var(--text-strong)" : "1px solid transparent",
                            backgroundColor: c, cursor: "pointer", transition: "transform 0.1s",
                            transform: form.color === c ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Kierownik ekipy
                  </label>
                  <input
                    type="text"
                    value={form.leaderName}
                    onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
                    placeholder="np. Jan Kowalski"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Telefon kontaktowy
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="np. +48 600 100 200"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    PIN do aplikacji mobilnej (4 cyfry)
                  </label>
                  <input
                    type="text"
                    value={form.pin}
                    maxLength={4}
                    pattern="[0-9]*"
                    onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="np. 1234"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                      fontFamily: "monospace", letterSpacing: "0.2em",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Członkowie ekipy (oddzieleni przecinkami)
                  </label>
                  <input
                    type="text"
                    value={form.membersText}
                    onChange={(e) => setForm((f) => ({ ...f, membersText: e.target.value }))}
                    placeholder="np. Piotr Nowak, Adam Wiśniewski, Tomasz Wójcik"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                <input
                  type="checkbox"
                  id="teamIsActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="teamIsActive" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-strong)", cursor: "pointer" }}>
                  Ekipa aktywna (widoczna na listach wyboru w zleceniach i kalendarzu)
                </label>
              </div>

              <div style={{ display: "flex", justifyRight: "flex-end", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 6, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--text-mute)",
                    background: "none", border: "none", cursor: "pointer", borderRadius: 8,
                  }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn primary"
                  style={{
                    padding: "8px 20px", fontSize: 12.5, fontWeight: 600, borderRadius: 8,
                    cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Utwórz ekipę"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teams Grid Cards */}
      {filteredTeams.length === 0 ? (
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "48px 24px",
          textAlign: "center", color: "var(--text-mute)",
        }}>
          <Wrench style={{ width: 44, height: 44, margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Brak ekip montażowych</p>
          <p style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 4 }}>Nie znaleziono ekip spełniających kryteria wyszukiwania.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredTeams.map((team) => {
            const teamColor = team.color ?? "#10b981";

            return (
              <div
                key={team._id}
                style={{
                  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  gap: 16, transition: "box-shadow 0.15s, border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Top Bar: Color, Name, Status */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div
                        style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: teamColor, flexShrink: 0, boxShadow: "0 0 0 2px rgba(0,0,0,0.06)" }}
                      />
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {team.name}
                      </h3>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {team.isActive ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Aktywna
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--panel-2)", color: "var(--text-mute)", border: "1px solid var(--line)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Nieaktywna
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Leader & Contact Box */}
                  <div style={{
                    fontSize: 12, color: "var(--text-mute)", background: "var(--panel)", padding: 12, borderRadius: 8,
                    border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <UserCheck style={{ width: 14, height: 14, color: "var(--text-mute)", flexShrink: 0 }} />
                      <span style={{ color: "var(--text-mute)" }}>Kierownik:</span>
                      <span style={{ fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {team.leaderName || "Nie przypisano"}
                      </span>
                    </div>

                    {team.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Phone style={{ width: 14, height: 14, color: "var(--text-mute)", flexShrink: 0 }} />
                        <span style={{ color: "var(--text-mute)" }}>Tel:</span>
                        <a href={`tel:${team.phone}`} style={{ fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                          {team.phone}
                        </a>
                      </div>
                    )}

                    {team.pin && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Key style={{ width: 14, height: 14, color: "var(--text-mute)", flexShrink: 0 }} />
                        <span style={{ color: "var(--text-mute)" }}>PIN (apka):</span>
                        <span style={{ fontWeight: 700, color: "var(--text-strong)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                          {team.pin}
                        </span>
                      </div>
                    )}

                    {team.members && team.members.length > 0 && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: 6, borderTop: "1px solid var(--line)", marginTop: 2 }}>
                        <Users style={{ width: 14, height: 14, color: "var(--text-mute)", flexShrink: 0, marginTop: 2 }} />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {team.members.map((m, idx) => (
                            <span key={idx} style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 500, color: "var(--text-strong)" }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KPI Badges */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>{team.ordersCount ?? 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>Zlecenia</div>
                    </div>

                    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{team.upcomingInstallationsCount ?? 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>Montaże</div>
                    </div>

                    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: team.openComplaintsCount ? "#f59e0b" : "var(--text-strong)" }}>
                        {team.openComplaintsCount ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>Serwisy</div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <Link
                    href={`/admin/ekipy/${team._id}`}
                    style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                      padding: "8px 12px", background: "var(--text-strong)", color: "var(--card)", fontSize: 12,
                      fontWeight: 600, borderRadius: 8, textDecoration: "none", transition: "opacity 0.15s",
                    }}
                  >
                    Szczegóły ekipy
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  </Link>

                  <button
                    onClick={() => openEdit(team)}
                    title="Edytuj ekipę"
                    style={{
                      padding: 8, color: "var(--text-mute)", background: "var(--panel)", border: "1px solid var(--line)",
                      borderRadius: 8, cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>

                  <button
                    onClick={() => handleDelete(team._id, team.name)}
                    title="Usuń ekipę"
                    style={{
                      padding: 8, color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 8, cursor: "pointer", transition: "background 0.15s",
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
