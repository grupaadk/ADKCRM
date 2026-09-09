"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useStatusLabel } from "@/components/StatusLabelsContext";
import DriveFolderButton from "@/components/DriveFolderButton";
import OpportunityAttachmentsSection from "@/app/admin/szansa/[id]/OpportunityAttachmentsSection";
import OpportunityEmailThreadsSection from "@/app/admin/szansa/[id]/OpportunityEmailThreadsSection";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  Sparkles,
  Check,
  ChevronRight,
  Users,
  MessageSquare,
  Archive,
  ArchiveRestore,
  Trash2,
  Tag,
  FolderOpen,
  Sliders,
} from "lucide-react";

interface ConfiguratorObject {
  variant?: string;
  width?: string;
  depth?: string;
  dimensions?: string;
  area?: string;
  options?: string;
  location?: string;
  userNotes?: string;
}

function parseConfiguratorData(commentStr?: string): { parsedConfig: ConfiguratorObject | null; displayComment: string } {
  if (!commentStr) return { parsedConfig: null, displayComment: "" };

  const hasConfigKeywords = 
    commentStr.includes("Wariant:") || 
    commentStr.includes("Wymiary:") || 
    commentStr.includes("Wyposażenie:");

  if (!hasConfigKeywords) {
    return { parsedConfig: null, displayComment: commentStr };
  }

  const parts = commentStr.split("|").map(s => s.trim());
  const config: ConfiguratorObject = {};
  const notesParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith("Wariant:")) {
      config.variant = part.replace(/^Wariant:\s*/, "").trim();
    } else if (part.startsWith("Wymiary:")) {
      const dimStr = part.replace(/^Wymiary:\s*/, "").trim();
      const areaMatch = dimStr.match(/\(([^)]+)\)/);
      if (areaMatch) {
        config.area = areaMatch[1].trim();
        config.dimensions = dimStr.replace(/\s*\([^)]+\)/, "").trim();
      } else {
        config.dimensions = dimStr;
      }
    } else if (part.startsWith("Wyposażenie:")) {
      config.options = part.replace(/^Wyposażenie:\s*/, "").trim();
    } else if (part.startsWith("Lokalizacja:")) {
      config.location = part.replace(/^Lokalizacja:\s*/, "").trim();
    } else if (part.startsWith("Uwagi:")) {
      const val = part.replace(/^Uwagi:\s*/, "").trim();
      if (val && val !== "Brak dodatkowych uwag") {
        config.userNotes = val;
      }
    } else if (!part.startsWith("Załączone pliki")) {
      notesParts.push(part);
    }
  }

  const cleanNotes = [config.userNotes, ...notesParts].filter(Boolean).join("\n");
  
  return {
    parsedConfig: (config.variant || config.dimensions || config.options) ? config : null,
    displayComment: cleanNotes,
  };
}

function MobileOpportunityPageMain({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId: rawId } = use(params);
  const opportunityId = rawId as Id<"pendingJotformSubmissions">;

  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const opp = useQuery(api.salesOpportunities.getSalesOpportunity, { opportunityId });
  const users = useQuery(api.users.listAllActive) ?? [];
  const servicesList = useQuery(api.services.listActive) ?? [];

  const updateField = useMutation(api.salesOpportunities.updateOpportunity);
  const updateStage = useMutation(api.salesOpportunities.updateOpportunityStage);
  const archiveOpp = useMutation(api.salesOpportunities.archiveOpportunity);
  const unarchiveOpp = useMutation(api.salesOpportunities.unarchiveOpportunity);
  const deleteOpp = useMutation(api.salesOpportunities.deleteSalesOpportunity);
  const convertToOrder = useMutation(api.salesOpportunities.convertToOrder);
  const assignOpportunity = useMutation(api.salesOpportunities.assignOpportunity);
  const retryFolder = useAction(api.googleDrive.createOpportunityFolder);

  const [converting, setConverting] = useState(false);
  const [commentText, setCommentText] = useState<string | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retryingFolder, setRetryingFolder] = useState(false);

  const stage = opp?.stage ?? "lead";
  const stageLabel = useStatusLabel(stage);

  const handleBack = () => {
    if (fromParam === "panel") {
      router.push("/app?tab=panel");
    } else {
      router.push("/app");
    }
  };

  const clientName = useMemo(() => {
    if (!opp) return "Ładowanie...";
    if (opp.companyName) return opp.companyName;
    return `${opp.firstName} ${opp.lastName}`.trim() || "Brak nazwy";
  }, [opp]);

  const mainAddress = useMemo(() => {
    if (!opp) return "";
    return [opp.street, opp.postalCode, opp.city].filter(Boolean).join(", ");
  }, [opp]);

  const investmentAddress = useMemo(() => {
    if (!opp) return "";
    return [opp.investmentStreet, opp.investmentPostalCode, opp.investmentCity].filter(Boolean).join(", ");
  }, [opp]);

  const mainMapsUrl = useMemo(() => {
    if (!mainAddress) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainAddress)}`;
  }, [mainAddress]);

  const investmentMapsUrl = useMemo(() => {
    if (!investmentAddress) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(investmentAddress)}`;
  }, [investmentAddress]);

  const assigneesArray = useMemo(() => {
    if (!opp) return [];
    return Array.from(
      new Set([
        ...(opp.assignedUserId ? [opp.assignedUserId] : []),
        ...(opp.assignedUserIds || []),
      ])
    );
  }, [opp]);

  const handleToggleStage = async () => {
    if (!opp) return;
    const nextStage = stage === "lead" ? "inquiry" : "lead";
    try {
      await updateStage({ opportunityId, stage: nextStage });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd zmiany etapu");
    }
  };

  const handleConvert = async () => {
    if (!opp || converting) return;
    setConverting(true);
    try {
      const res = await convertToOrder({ opportunityId });
      router.push(`/app/zlecenie/${res.orderId}?from=panel`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd konwersji na zlecenie");
      setConverting(false);
    }
  };

  const handleSaveComment = async () => {
    if (commentText === null || !opp) return;
    setSavingComment(true);
    try {
      await updateField({ opportunityId, comment: commentText });
      setCommentText(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd zapisu komentarza");
    } finally {
      setSavingComment(false);
    }
  };

  const handleToggleService = async (serviceName: string) => {
    if (!opp) return;
    const currentServices = opp.services ?? [];
    const nextServices = currentServices.includes(serviceName)
      ? currentServices.filter((s) => s !== serviceName)
      : [...currentServices, serviceName];
    await updateField({ opportunityId, services: nextServices });
  };

  const handleToggleUserAssignee = async (userId: Id<"users">) => {
    if (!opp) return;
    const nextAssignees = assigneesArray.includes(userId)
      ? assigneesArray.filter((id) => id !== userId)
      : [...assigneesArray, userId];
    await assignOpportunity({ opportunityId, assignedUserIds: nextAssignees });
  };

  const handleArchiveToggle = async () => {
    if (!opp) return;
    try {
      if (opp.archived) {
        await unarchiveOpp({ opportunityId });
      } else {
        await archiveOpp({ opportunityId });
      }
      handleBack();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd zmiany stanu archiwum");
    }
  };

  const handleDelete = async () => {
    if (!opp) return;
    try {
      await deleteOpp({ opportunityId });
      handleBack();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd usuwania szansy");
    }
  };

  const handleCreateFolderRetry = async () => {
    setRetryingFolder(true);
    try {
      await retryFolder({ opportunityId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd tworzenia folderu Drive");
    } finally {
      setRetryingFolder(false);
    }
  };

  if (opp === undefined) {
    return (
      <div className="h-full w-full bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin size-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (opp === null) {
    return (
      <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-4 space-y-3 text-center">
        <p className="text-sm font-bold text-slate-700">Szansa sprzedaży nie została znaleziona</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Powrót do panelu
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto scroll-smooth pb-24 text-slate-800 antialiased select-none">
      {/* App Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-3 shadow-2xs flex items-center gap-3">
        <button
          onClick={handleBack}
          type="button"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:scale-95 transition text-slate-700"
          title="Powrót"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-slate-900 truncate">{clientName}</h1>
            <span
              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                stage === "inquiry"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-purple-50 text-purple-700 border-purple-200"
              }`}
            >
              {stageLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium truncate">
            Szansa sprzedaży {opp.submissionId ? `· Jotform #${opp.submissionId}` : ""}
          </p>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="p-3.5 space-y-3 max-w-xl mx-auto">
        {/* Quick Action Bar (Zadzwoń, E-mail, Utwórz zlecenie, Zmień etap) */}
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200/90 shadow-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {opp.phone ? (
              <a
                href={`tel:${opp.phone}`}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 px-3 font-bold text-xs shadow-xs active:scale-98 transition"
              >
                <Phone className="size-4" />
                <span>Zadzwoń</span>
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 rounded-xl py-2.5 px-3 font-bold text-xs cursor-not-allowed"
              >
                <Phone className="size-4" />
                <span>Brak telefonu</span>
              </button>
            )}

            {opp.email ? (
              <a
                href={`mailto:${opp.email}`}
                className="flex items-center justify-center gap-2 bg-sky-600 text-white rounded-xl py-2.5 px-3 font-bold text-xs shadow-xs active:scale-98 transition"
              >
                <Mail className="size-4" />
                <span>Wyślij E-mail</span>
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 rounded-xl py-2.5 px-3 font-bold text-xs cursor-not-allowed"
              >
                <Mail className="size-4" />
                <span>Brak e-maila</span>
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting || opp.processed}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-xl py-2.5 px-3 font-extrabold text-xs shadow-xs active:scale-98 transition disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              <span>{converting ? "Tworzenie..." : "Utwórz Zlecenie"}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleStage}
              className="flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-xl py-2.5 px-3 font-extrabold text-xs active:scale-98 transition"
            >
              <span>{stage === "lead" ? "Oznacz: Oferta" : "Oznacz: Lead"}</span>
              <ChevronRight className="size-4 text-purple-500" />
            </button>
          </div>
        </div>

        {/* Sekcja Konfiguratora (Zabudowa tarasu) */}
        {(() => {
          const isTerraceService = (opp.services ?? []).includes("Zabudowa tarasu");
          const { parsedConfig } = parseConfiguratorData(opp.comment);

          if (!isTerraceService && !parsedConfig) return null;

          return (
            <section className="bg-teal-50/80 border border-teal-200 rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="size-4 text-teal-600" /> Odpowiedzi z Konfiguratora
                </h2>
                <span className="text-[10px] font-extrabold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                  Zabudowa tarasu
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {parsedConfig?.variant && (
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Wariant</span>
                    <p className="font-extrabold text-slate-900">{parsedConfig.variant}</p>
                  </div>
                )}
                {parsedConfig?.dimensions && (
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Wymiary</span>
                    <p className="font-extrabold text-slate-900">{parsedConfig.dimensions}</p>
                  </div>
                )}
                {parsedConfig?.area && (
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Powierzchnia</span>
                    <p className="font-extrabold text-teal-700">{parsedConfig.area}</p>
                  </div>
                )}
                {parsedConfig?.location && (
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Miejscowość</span>
                    <p className="font-extrabold text-slate-900">{parsedConfig.location}</p>
                  </div>
                )}
              </div>

              {parsedConfig?.options && (
                <div className="bg-white p-2.5 rounded-xl border border-teal-100 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Wyposażenie dodatkowe</span>
                  <p className="font-semibold text-slate-800">{parsedConfig.options}</p>
                </div>
              )}
            </section>
          );
        })()}

        {/* Sekcja 1: Dane Kontaktu & Adres */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="size-4 text-purple-600" /> Dane Kontaktowe
          </h2>

          <div className="space-y-2 text-xs">
            <div>
              <p className="font-extrabold text-slate-900 text-sm">
                {opp.firstName} {opp.lastName}
              </p>
            </div>

            {/* Adres główny */}
            {mainAddress && (
              <div className="flex items-start justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Adres klienta</span>
                  <p className="font-semibold">{mainAddress}</p>
                </div>
                {mainMapsUrl && (
                  <a
                    href={mainMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-slate-100 shrink-0"
                    title="Nawiguj"
                  >
                    <MapPin className="size-4" />
                  </a>
                )}
              </div>
            )}

            {/* Adres inwestycji */}
            {investmentAddress && (
              <div className="flex items-start justify-between gap-2 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100 text-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase block">Adres inwestycji</span>
                  <p className="font-semibold">{investmentAddress}</p>
                </div>
                {investmentMapsUrl && (
                  <a
                    href={investmentMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 shrink-0"
                    title="Nawiguj do inwestycji"
                  >
                    <MapPin className="size-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Sekcja 2: Wybrane Usługi */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="size-4 text-purple-600" /> Wybrane Usługi
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {servicesList.map((srv) => {
              const active = (opp.services ?? []).includes(srv.name);
              return (
                <button
                  key={srv._id}
                  type="button"
                  onClick={() => handleToggleService(srv.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                    active
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {active && <Check className="size-3.5" />}
                  <span>{srv.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sekcja 3: Przypisani Opiekunowie */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="size-4 text-purple-600" /> Przypisany Opiekun
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const isAssigned = assigneesArray.includes(u._id);
              const uName = u.displayName ?? u.login ?? "Użytkownik";

              return (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => handleToggleUserAssignee(u._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                    isAssigned
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {u.color && (
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: u.color }}
                    />
                  )}
                  <span>{uName}</span>
                  {isAssigned && <Check className="size-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sekcja Korespondencji E-mail (Gmail) */}
        <OpportunityEmailThreadsSection
          clientEmail={opp.email}
          defaultEmail="aluminiumadk@gmail.com"
        />

        {/* Sekcja 4: Komentarz & Notatka */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="size-4 text-purple-600" /> Komentarz / Notatki
          </h2>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={commentText !== null ? commentText : opp.comment ?? ""}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Wpisz komentarz lub notatkę..."
              className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-600 font-medium"
            />
            {commentText !== null && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommentText(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleSaveComment}
                  disabled={savingComment}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-2xs active:scale-95 transition disabled:opacity-50"
                >
                  {savingComment ? "Zapisywanie..." : "Zapisz komentarz"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Sekcja 5: Załączniki i Dysk Google */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="size-4 text-purple-600" /> Załączniki & Dysk
            </h2>
            <DriveFolderButton
              folderUrl={opp.opportunityFolderUrl}
              createdAt={opp._creationTime}
              onCreate={handleCreateFolderRetry}
              busy={retryingFolder}
            />
          </div>

          <OpportunityAttachmentsSection
            opportunityId={opportunityId}
            opportunityFolderId={opp.opportunityFolderId}
          />
        </section>

        {/* Sekcja 6: Zarządzanie Szansą */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zarządzanie</h2>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleArchiveToggle}
              className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl py-2.5 px-3 font-bold text-xs active:scale-98 transition"
            >
              {opp.archived ? (
                <>
                  <ArchiveRestore className="size-4" />
                  <span>Przywróć Szansę z Archiwum</span>
                </>
              ) : (
                <>
                  <Archive className="size-4" />
                  <span>Archiwizuj Szansę</span>
                </>
              )}
            </button>

            {confirmDelete ? (
              <div className="bg-red-50 p-3 rounded-xl border border-red-200 space-y-2 text-center">
                <p className="text-xs font-bold text-red-800">Czy na pewno usunąć tę szansę?</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-slate-700 text-xs font-bold"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-xs"
                  >
                    Tak, usuń
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 text-red-600 border border-slate-200/80 hover:bg-red-50 hover:border-red-200 rounded-xl py-2.5 px-3 font-bold text-xs active:scale-98 transition"
              >
                <Trash2 className="size-4" />
                <span>Usuń Szansę Sprzedaży</span>
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function MobileOpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-slate-50 flex items-center justify-center p-4">
          <div className="animate-spin size-8 border-4 border-purple-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <MobileOpportunityPageMain params={params} />
    </Suspense>
  );
}
