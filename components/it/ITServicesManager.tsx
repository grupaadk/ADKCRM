"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  CreditCard,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  X,
  Server,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  Layers,
} from "lucide-react";

type BillingCycle = "monthly" | "yearly" | "quarterly" | "usage_based";

export function ITServicesManager() {
  const services = useQuery(api.itServices.getServices);
  const createService = useMutation(api.itServices.createService);
  const updateService = useMutation(api.itServices.updateService);
  const deleteService = useMutation(api.itServices.deleteService);

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<Id<"itServices"> | null>(null);

  // Stan widoczności haseł na liście (ID usługi -> boolean)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Stan podglądu hasła w formularzu modala
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Identyfikator ostatnio skopiowanego elementu (do pokazywania ikony Check)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stan formularza modala (tylko potrzebne pola: bez kategorii, statusu, NIPu i notatek)
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    cost: 0,
    currency: "PLN",
    billingCycle: "monthly" as BillingCycle,
    renewalDay: "" as number | string,
    renewalDate: "",
    paymentMethod: "Karta firmowa",
    websiteUrl: "",
    adminEmail: "",
    password: "",
  });

  // Filtrowanie listy usług wyłącznie po wyszukiwaniu tekstowym
  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (!searchQuery.trim()) return services;

    const q = searchQuery.toLowerCase();
    return services.filter((srv) => {
      return (
        srv.name.toLowerCase().includes(q) ||
        (srv.provider && srv.provider.toLowerCase().includes(q)) ||
        (srv.adminEmail && srv.adminEmail.toLowerCase().includes(q))
      );
    });
  }, [services, searchQuery]);

  // Obliczenia statystyk miesięcznych i rocznych (wyłącznie PLN)
  const stats = useMemo(() => {
    if (!services) return { plnTotal: 0, plnYearly: 0, totalCount: 0 };
    let plnTotal = 0;

    for (const s of services) {
      let monthlyAmount = s.cost;
      if (s.billingCycle === "yearly") monthlyAmount = s.cost / 12;
      if (s.billingCycle === "quarterly") monthlyAmount = s.cost / 3;
      plnTotal += monthlyAmount;
    }

    const plnYearly = plnTotal * 12;
    return { plnTotal, plnYearly, totalCount: services.length };
  }, [services]);

  const togglePasswordVisibility = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopy = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Błąd dostępu do schowka
    }
  };

  const handleOpenAddModal = () => {
    setEditingServiceId(null);
    setShowModalPassword(false);
    setFormData({
      name: "",
      provider: "",
      cost: 0,
      currency: "PLN",
      billingCycle: "monthly",
      renewalDay: "",
      renewalDate: "",
      paymentMethod: "Karta firmowa",
      websiteUrl: "",
      adminEmail: "",
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: Doc<"itServices">) => {
    setEditingServiceId(service._id);
    setShowModalPassword(false);
    setFormData({
      name: service.name,
      provider: service.provider || "",
      cost: service.cost,
      currency: "PLN",
      billingCycle: service.billingCycle,
      renewalDay: service.renewalDay ?? "",
      renewalDate: service.renewalDate || "",
      paymentMethod: service.paymentMethod || "Karta firmowa",
      websiteUrl: service.websiteUrl || "",
      adminEmail: service.adminEmail || "",
      password: service.password || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const parsedDay = formData.renewalDay !== "" ? parseInt(String(formData.renewalDay), 10) : undefined;
    const cleanDate = formData.renewalDate.trim() || undefined;

    if (editingServiceId) {
      await updateService({
        id: editingServiceId,
        name: formData.name.trim(),
        provider: formData.provider.trim() || undefined,
        cost: Number(formData.cost) || 0,
        currency: "PLN",
        billingCycle: formData.billingCycle,
        renewalDay: parsedDay,
        renewalDate: cleanDate,
        paymentMethod: formData.paymentMethod || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        adminEmail: formData.adminEmail || undefined,
        password: formData.password || undefined,
      });
    } else {
      await createService({
        name: formData.name.trim(),
        provider: formData.provider.trim() || undefined,
        cost: Number(formData.cost) || 0,
        currency: "PLN",
        billingCycle: formData.billingCycle,
        renewalDay: parsedDay,
        renewalDate: cleanDate,
        paymentMethod: formData.paymentMethod || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        adminEmail: formData.adminEmail || undefined,
        password: formData.password || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const handleDeleteService = async (id: Id<"itServices">, name: string) => {
    if (confirm(`Czy na pewno chcesz usunąć usługę "${name}"?`)) {
      await deleteService({ id });
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Podsumowanie finansowe i KPI ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Koszt PLN miesięczny */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Koszt miesięczny</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {stats.plnTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
            </span>
            <span className="text-xs text-slate-400">/ mies.</span>
          </div>
        </div>

        {/* Szacowany koszt roczny */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Szacowany koszt roczny</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {stats.plnYearly.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
            </span>
            <span className="text-xs text-slate-400">/ rok</span>
          </div>
        </div>

        {/* Liczba zarejestrowanych usług */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Usługi i narzędzia</span>
            <div className="p-2 rounded-xl bg-[#4dbdc6]/10 text-[#4dbdc6]">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalCount}</span>
            <span className="text-xs text-slate-400">pozycji w spisie</span>
          </div>
        </div>
      </div>

      {/* ─── Pasek wyszukiwania i przycisk dodawania ────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Szukajka */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj usługi, dostawcy lub loginu..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Przycisk dodawania nowej usługi */}
        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition cursor-pointer shadow-xs"
        >
          <Plus className="size-3.5" />
          Dodaj usługę
        </button>
      </div>

      {/* ─── Tabela usług i haseł IT ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Server className="size-10 mx-auto text-slate-300 stroke-[1.5]" />
            <div className="text-sm font-semibold text-slate-600">Brak zarejestrowanych usług IT</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Nie znaleziono usług pasujących do zapytania. Kliknij przycisk poniżej, aby dodać pierwszą usługę.
            </p>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold shadow-2xs hover:bg-brand-hover transition cursor-pointer"
            >
              <Plus className="size-3.5" /> Dodaj usługę
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Usługa i Dostawca</th>
                  <th className="py-3.5 px-4">Koszt i Rozliczenie</th>
                  <th className="py-3.5 px-4">Odnowienie / Płatność</th>
                  <th className="py-3.5 px-4">Dostęp / Logowanie</th>
                  <th className="py-3.5 px-4">Hasło</th>
                  <th className="py-3.5 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.map((service) => {
                  const isPasswordRevealed = !!revealedPasswords[service._id];

                  return (
                    <tr
                      key={service._id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Nazwa i dostawca */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shrink-0">
                            <Server className="size-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{service.name}</span>
                              {service.websiteUrl && (
                                <a
                                  href={service.websiteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-brand"
                                  title="Przejdź do panelu logowania"
                                >
                                  <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                            {service.provider && (
                              <div className="text-[11px] text-slate-400 mt-0.5">{service.provider}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Koszt i cykl */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {service.cost} zł
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {service.billingCycle === "monthly" && "miesięcznie"}
                          {service.billingCycle === "yearly" && "rocznie"}
                          {service.billingCycle === "quarterly" && "kwartalnie"}
                          {service.billingCycle === "usage_based" && "wg zużycia"}
                        </div>
                      </td>

                      {/* Dzień odnowienia / data i płatność */}
                      <td className="py-3.5 px-4">
                        {service.renewalDate ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Calendar className="size-3.5 text-brand" />
                            <span>{service.renewalDate}</span>
                          </div>
                        ) : service.renewalDay ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Calendar className="size-3.5 text-slate-400" />
                            <span>{service.renewalDay}. dzień msc</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {service.paymentMethod || "Karta"}
                        </div>
                      </td>

                      {/* Login / Email */}
                      <td className="py-3.5 px-4">
                        {service.adminEmail ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-800 font-medium truncate max-w-[170px]" title={service.adminEmail}>
                              {service.adminEmail}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(service.adminEmail!, `email-${service._id}`)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition cursor-pointer"
                              title="Kopiuj login / email"
                            >
                              {copiedId === `email-${service._id}` ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Hasło */}
                      <td className="py-3.5 px-4">
                        {service.password ? (
                          <div className="flex items-center gap-1.5">
                            <div className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {isPasswordRevealed ? service.password : "••••••••"}
                            </div>
                            {/* Toggle widoczności */}
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(service._id)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                              title={isPasswordRevealed ? "Ukryj hasło" : "Pokaż hasło"}
                            >
                              {isPasswordRevealed ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </button>
                            {/* Kopiowanie hasła */}
                            <button
                              type="button"
                              onClick={() => handleCopy(service.password!, `pwd-${service._id}`)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                              title="Kopiuj hasło do schowka"
                            >
                              {copiedId === `pwd-${service._id}` ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Akcje */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(service)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Edytuj usługę"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service._id, service.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Usuń usługę"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal Dodawania / Edycji Usługi ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Nagłówek modala */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-brand" />
                <h2 className="text-sm font-bold text-slate-900">
                  {editingServiceId ? "Edycja usługi IT" : "Dodaj nową usługę IT / subskrypcję"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Treść formularza */}
            <form onSubmit={handleSaveService} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Nazwa i dostawca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nazwa usługi *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Wpisz nazwę usługi..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dostawca / Firma
                  </label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Wpisz nazwę dostawcy..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Koszt w PLN i cykl rozliczeniowy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kwota (PLN) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                      zł
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cykl rozliczeniowy
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as BillingCycle })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
                  >
                    <option value="monthly">Miesięcznie</option>
                    <option value="yearly">Rocznie</option>
                    <option value="quarterly">Kwartalnie</option>
                    <option value="usage_based">Płatność wg zużycia (np. SMS)</option>
                  </select>
                </div>
              </div>

              {/* Dzień odnowienia, data i metoda płatności */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dzień msc (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.renewalDay}
                    onChange={(e) => setFormData({ ...formData, renewalDay: e.target.value })}
                    placeholder="np. 15 (co msc)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Data odnowienia
                  </label>
                  <input
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Metoda płatności
                  </label>
                  <input
                    type="text"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    placeholder="np. Karta, Przelew"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {/* URL panelu / logowania */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Link do logowania / panelu klienta
                </label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Sekcja dostępu: Login i Hasło */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-slate-500" />
                  Dane dostępowe do konta
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Login / Email
                    </label>
                    <input
                      type="text"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      placeholder="np. admin@grupaadk.pl"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Hasło dostępowe
                    </label>
                    <div className="relative">
                      <input
                        type={showModalPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Wpisz hasło..."
                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        {showModalPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Przyciski akcji modala */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition cursor-pointer shadow-xs"
                >
                  {editingServiceId ? "Zapisz zmiany" : "Dodaj usługę"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
