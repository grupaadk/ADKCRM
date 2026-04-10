"use client";

import type { ReactNode } from "react";
import { use, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InlineEdit from "../../InlineEdit";
import DocumentCheckboxes from "../../DocumentCheckboxes";
import WarrantyCardUpload from "../../WarrantyCardUpload";
import OrderLineItems from "../../OrderLineItems";
import Notes from "../../Notes";

const STATUS_ORDER = [
  "lead", "inquiry", "measurement", "offer", "contract",
  "production", "installation", "completed", "warranty",
] as const;

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  inquiry: "Oferta wstepna",
  measurement: "Pomiar",
  offer: "Oferta",
  contract: "Umowa",
  production: "Produkcja",
  installation: "Montaz",
  completed: "Zakonczone",
  warranty: "Gwarancja",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  lead: ["inquiry", "measurement"],
  inquiry: ["measurement", "offer"],
  measurement: ["offer", "contract"],
  offer: ["contract", "lead"],
  contract: ["production"],
  production: ["installation"],
  installation: ["completed"],
  completed: ["warranty"],
  warranty: [],
};

const ORDER_VISIBLE_STATUSES = new Set([
  "measurement", "offer", "contract", "production",
  "installation", "completed", "warranty",
]);

const COLOR_FIELDS: Array<{ key: string; label: string }> = [
  { key: "windowColor", label: "Okna" },
  { key: "doorColor", label: "Drzwi" },
  { key: "gateColor", label: "Brama" },
  { key: "terraceColor", label: "Zabudowa tarasu" },
  { key: "constructionColor", label: "Konstrukcja" },
];

type Tab = "zlecenie" | "wycena" | "dokumenty" | "notatki";

function getProjectFileLinks(projectFiles: string | undefined) {
  if (!projectFiles) return [];
  return projectFiles.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function getFileName(url: string, index: number) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).at(-1) || `Zalacznik ${index + 1}`;
  } catch {
    return `Zalacznik ${index + 1}`;
  }
}

function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function ColorCard({ label, values }: { label: string; values: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">{v}</span>
        ))}
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = use(params);
  const clientId = id as Id<"clients">;
  const orderIdTyped = orderId as Id<"orders">;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("zlecenie");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const client = useQuery(api.clients.getById, { clientId });
  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const events = useQuery(api.events.listByOrder, { orderId: orderIdTyped });
  const changeStatus = useMutation(api.orders.changeStatus);
  const createOrderFolder = useAction(api.googleDrive.createOrderFolder);
  const deleteOrder = useAction(api.orders.deleteOrder);

  if (client === undefined || order === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-400">Ladowanie...</div>
      </div>
    );
  }

  if (!client || !order) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Nie znaleziono.</div>
        <Link href={`/admin/klient/${id}`} className="text-sm text-blue-600 hover:underline">
          Wroc do klienta
        </Link>
      </div>
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[order.status] ?? [];
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const currentStatusIndex = STATUS_ORDER.indexOf(order.status as (typeof STATUS_ORDER)[number]);
  const showOrderDetails = ORDER_VISIBLE_STATUSES.has(order.status);
  const projectFileLinks = getProjectFileLinks(order.projectFiles);

  async function handleStatusChange(newStatus: string) {
    try {
      await changeStatus({
        orderId: orderIdTyped,
        newStatus: newStatus as "lead" | "inquiry" | "measurement" | "offer" | "contract" | "production" | "installation" | "completed" | "warranty",
      });
    } catch (error) {
      console.error("Status change failed:", error);
    }
  }

  async function handleCreateFolder() {
    try {
      await createOrderFolder({ orderId: orderIdTyped });
    } catch (error) {
      console.error("Folder creation failed:", error);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteOrder({ orderId: orderIdTyped });
      router.push(`/admin/klient/${id}`);
    } catch (error) {
      console.error("Order deletion failed:", error);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "zlecenie", label: "Zlecenie" },
    { key: "wycena", label: "Wycena" },
    { key: "dokumenty", label: "Dokumenty" },
    { key: "notatki", label: "Notatki" },
  ];

  const createdDate = new Date(order._creationTime).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
  const orderNumber = order.name ?? `Zlecenie z ${createdDate}`;
  const servicesSummary = order.services?.slice(0, 3).join(", ") ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              <Link href="/admin" className="hover:text-slate-600">Klienci</Link>
              <span>/</span>
              <Link href={`/admin/klient/${id}`} className="hover:text-slate-600">
                {client.firstName} {client.lastName}
              </Link>
              <span>/</span>
              <span className="text-slate-600">{orderNumber}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {orderNumber}
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {client.firstName} {client.lastName}
              {client.city ? ` • ${client.city}` : ""}
              {servicesSummary ? ` • ${servicesSummary}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Usun
            </button>
          </div>
        </div>

        {/* Status progress bar */}
        <div className="overflow-x-auto border-t border-slate-100 px-6 py-4">
          <div className="flex min-w-max items-center gap-0">
            {STATUS_ORDER.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isLast = index === STATUS_ORDER.length - 1;
              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${isCurrent ? "bg-blue-600 text-white shadow-md shadow-blue-200" : isPast ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {isPast ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : <span>{index + 1}</span>}
                    </div>
                    <span className={`mt-1.5 whitespace-nowrap text-[10px] font-semibold ${isCurrent ? "text-blue-600" : isPast ? "text-emerald-600" : "text-slate-400"}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={`mb-4 h-px w-8 ${isPast || isCurrent ? "bg-emerald-300" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors sm:flex-none ${activeTab === tab.key ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Zlecenie */}
      {activeTab === "zlecenie" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <SectionCard title="Linki">
              <div className="space-y-3">
                {order.folderUrl ? (
                  <a href={order.folderUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                        <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">Google Drive</span>
                    </div>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <p className="mb-3 text-sm text-slate-500">Folder zlecenia nie zostal jeszcze utworzony.</p>
                    <button onClick={handleCreateFolder}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                      Utworz folder
                    </button>
                  </div>
                )}

                {order.trelloCardUrl && (
                  <a href={order.trelloCardUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                        <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.645-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44H15c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">Karta Trello</span>
                    </div>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-3">
            <SectionCard title="Szczegoly zlecenia">
              {showOrderDetails ? (
                <div className="space-y-6">
                  {order.services && order.services.length > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Uslugi</div>
                      <div className="flex flex-wrap gap-2">
                        {order.services.map((service) => (
                          <span key={service} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{service}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {COLOR_FIELDS.some(({ key }) => (order[key as keyof typeof order] as string[] | undefined)?.length) && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kolory</div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {COLOR_FIELDS.map(({ key, label }) => (
                          <ColorCard key={key} label={label} values={(order[key as keyof typeof order] as string[] | undefined) ?? []} />
                        ))}
                      </div>
                    </div>
                  )}

                  {order.sunProtectionType && order.sunProtectionType.length > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">System przeciwsloneczny</div>
                      <div className="flex flex-wrap gap-2">
                        {order.sunProtectionType.map((type) => (
                          <span key={type} className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{type}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {projectFileLinks.length > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pliki projektu</div>
                      <div className="space-y-2">
                        {projectFileLinks.map((fileUrl, index) => (
                          <a key={`${fileUrl}-${index}`} href={fileUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                            <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="text-sm font-medium text-slate-700">{getFileName(fileUrl, index)}</span>
                            <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.comment && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Komentarz</div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{order.comment}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">
                    Szczegoly zlecenia sa dostepne od statusu <strong className="text-slate-700">Pomiar</strong>.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* Tab: Wycena */}
      {activeTab === "wycena" && (
        <SectionCard title="Pozycje zamówienia">
          <OrderLineItems orderId={orderIdTyped} />
        </SectionCard>
      )}

      {/* Tab: Dokumenty */}
      {activeTab === "dokumenty" && (
        <div className="space-y-6">
          <DocumentCheckboxes orderId={orderIdTyped} documents={order.documents} />
          <SectionCard title="Karty gwarancyjne producentow">
            {order.warrantyCards && order.warrantyCards.length > 0 ? (
              <div className="mb-4 space-y-3">
                {order.warrantyCards.map((card, index) => (
                  <div key={`${card.manufacturer}-${card.uploadedAt}-${index}`}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{card.manufacturer}</div>
                      <div className="mt-1 text-xs text-slate-500">{card.type} • {new Date(card.uploadedAt).toLocaleDateString("pl-PL")}</div>
                    </div>
                    <a href={card.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                      Otworz plik
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm italic text-slate-400">Brak dodanych kart gwarancyjnych.</p>
            )}
            <WarrantyCardUpload orderId={orderIdTyped} />
          </SectionCard>
        </div>
      )}

      {/* Tab: Notatki */}
      {activeTab === "notatki" && (
        <Notes clientId={clientId} orderId={orderIdTyped} />
      )}

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Usunac zlecenie?</h2>
            <p className="mb-6 text-sm text-slate-500">
              Zostan usuniete wszystkie dane zlecenia, dokumenty i folder Google Drive.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Anuluj
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Usuwanie..." : "Tak, usun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
