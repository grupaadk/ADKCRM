import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Status workflow wg PRD sekcja 3.1
export const CLIENT_STATUSES = [
  "lead",
  "inquiry",
  "measurement",
  "offer",
  "contract",
  "production",
  "installation",
  "completed",
  "warranty",
] as const;

// Dozwolone przejścia statusów wg PRD US-2.1
export const STATUS_TRANSITIONS: Record<string, string[]> = {
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

// Typy dokumentów wg PRD sekcja 3.1 + 4.1
export const DOCUMENT_TYPES = [
  "pomiar",
  "umowa",
  "gwarancja_alco",
  "rekojmia_adk",
  "odbior_inwestor",
  "protokol_montaz",
  "faktura",
  "reklamacja",
] as const;

// Usługi z Jotform (sekcja 6.1)
export const SERVICES = [
  "Okna",
  "Drzwi",
  "Brama",
  "Zabudowa tarasu",
  "Konstrukcja aluminiowa",
  "Ogrodzenie",
  "System przeciwsłoneczny",
] as const;

const clientStatus = v.union(
  v.literal("lead"),
  v.literal("inquiry"),
  v.literal("measurement"),
  v.literal("offer"),
  v.literal("contract"),
  v.literal("production"),
  v.literal("installation"),
  v.literal("completed"),
  v.literal("warranty"),
);

const documentEntry = v.object({
  enabled: v.boolean(),
  url: v.optional(v.string()),
  generatedAt: v.optional(v.number()),
});

const warrantyCard = v.object({
  manufacturer: v.string(),
  type: v.string(),
  fileUrl: v.string(),
  uploadedAt: v.number(),
});

const documentSet = v.object({
  pomiar: documentEntry,
  umowa: documentEntry,
  gwarancja_alco: documentEntry,
  rekojmia_adk: documentEntry,
  odbior_inwestor: documentEntry,
  protokol_montaz: documentEntry,
  faktura: documentEntry,
  reklamacja: documentEntry,
});

const fakturowniaInvoiceEntry = v.object({
  kind: v.union(v.literal("advance"), v.literal("final")),
  remoteId: v.string(),
  number: v.optional(v.string()),
  grossAmount: v.optional(v.number()),
  createdAt: v.number(),
});

const fakturowniaOrderLink = v.object({
  estimateId: v.string(),
  estimateNumber: v.optional(v.string()),
  oid: v.optional(v.string()),
  estimateSyncedAt: v.number(),
  invoices: v.array(fakturowniaInvoiceEntry),
});

export default defineSchema({
  // 3.1 Klient — tylko dane kontaktowe
  clients: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nip: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
    source: v.union(v.literal("jotform"), v.literal("manual")),
    createdBy: v.string(),

    // Folder klienta (główny folder w Google Drive)
    clientFolderId: v.optional(v.string()),
    clientFolderUrl: v.optional(v.string()),

    // Pola legacy (zachowane dla danych istniejących, nieużywane przez nowy kod)
    address: v.optional(v.string()),
    status: v.optional(clientStatus),
    documents: v.optional(documentSet),
    warrantyCards: v.optional(v.array(warrantyCard)),
    folderId: v.optional(v.string()),
    folderUrl: v.optional(v.string()),
    trelloCardId: v.optional(v.string()),
    trelloCardUrl: v.optional(v.string()),
    jotformSubmissionId: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_source", ["source"])
    .searchIndex("search_clients", {
      searchField: "lastName",
      filterFields: ["city"],
    }),

  // 3.1b Zlecenie — dane zlecenia powiązane z klientem
  orders: defineTable({
    clientId: v.id("clients"),
    name: v.optional(v.string()),

    // Dane zlecenia
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),

    // Status workflow
    status: clientStatus,

    // Dokumenty
    documents: documentSet,

    // Karty gwarancyjne producentów
    warrantyCards: v.optional(v.array(warrantyCard)),

    // Google Drive
    folderId: v.optional(v.string()),
    folderUrl: v.optional(v.string()),

    // Trello
    trelloCardId: v.optional(v.string()),
    trelloCardUrl: v.optional(v.string()),

    // Metadane
    source: v.union(v.literal("jotform"), v.literal("manual")),
    jotformSubmissionId: v.optional(v.string()),
    createdBy: v.string(),

    // Fakturownia (zamówienie = estimate + faktury zaliczkowa / końcowa)
    fakturownia: v.optional(fakturowniaOrderLink),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_trello_card", ["trelloCardId"])
    .index("by_jotform_submission", ["jotformSubmissionId"]),

  // 3.2 Szablon dokumentu
  documentTemplates: defineTable({
    key: v.string(),
    name: v.string(),
    googleDriveFileId: v.optional(v.string()),
    fileNamePattern: v.string(),
    fieldMappings: v.array(
      v.object({
        placeholder: v.string(),
        field: v.string(),
      }),
    ),
    version: v.number(),
    isActive: v.boolean(),
  }).index("by_key", ["key"]),

  // 3.3 Historia zdarzeń
  clientEvents: defineTable({
    clientId: v.id("clients"),
    orderId: v.optional(v.id("orders")),
    type: v.string(),
    details: v.any(),
    performedBy: v.string(),
  })
    .index("by_client", ["clientId"])
    .index("by_order", ["orderId"])
    .index("by_client_and_type", ["clientId", "type"]),

  // 3.4 Konfiguracja Google Drive (singleton)
  driveConnection: defineTable({
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    sharedDriveId: v.optional(v.string()),
    templatesFolderId: v.optional(v.string()),
    connectionStatus: v.union(
      v.literal("connected"),
      v.literal("token_expiring"),
      v.literal("refreshing"),
      v.literal("expired"),
      v.literal("refresh_failed"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
    lastCheckedAt: v.optional(v.number()),
    connectedBy: v.string(),
    connectedEmail: v.string(),
  }),

  // 3.5 Konfiguracja widoku klientów (per user)
  viewConfig: defineTable({
    userId: v.string(),
    viewType: v.literal("table"),
    columns: v.array(v.string()),
    sortBy: v.object({
      field: v.string(),
      direction: v.union(v.literal("asc"), v.literal("desc")),
    }),
    filters: v.optional(
      v.array(
        v.object({
          field: v.string(),
          value: v.string(),
        }),
      ),
    ),
    groupBy: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // 3.6 Konfiguracja Jotform (singleton)
  jotformConfig: defineTable({
    apiKey: v.string(),
    formId: v.string(),
    webhookRegistered: v.boolean(),
  }),

  // 3.6c Konfiguracja Fakturownia (singleton)
  fakturowniaConfig: defineTable({
    apiToken: v.string(),
    subdomain: v.string(),
    /** @deprecated — usunięto podział na zaliczkę/fakturę końcową */
    advancePercent: v.optional(v.number()),
    departmentId: v.optional(v.string()),
    connectedBy: v.string(),
  }),

  // 3.6b Notatki do klienta / zlecenia
  clientNotes: defineTable({
    clientId: v.id("clients"),
    orderId: v.optional(v.id("orders")),
    content: v.string(),
    createdBy: v.string(),
  })
    .index("by_client", ["clientId"])
    .index("by_order", ["orderId"]),

  // 3.8 Oczekujące zgłoszenia z JotForm (przed utworzeniem klienta/zamówienia)
  // Klient + zamówienie tworzone są dopiero gdy karta Trello trafi na listę "Do pomiarów"
  pendingJotformSubmissions: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    trelloCardId: v.optional(v.string()),
    processed: v.boolean(),
  })
    .index("by_trello_card", ["trelloCardId"])
    .index("by_submission", ["submissionId"]),

  // 3.10 Oczekujące zgłoszenia z maila (przed ekstrakcją AI i utworzeniem klienta/zamówienia)
  pendingEmailSubmissions: defineTable({
    trelloCardId: v.optional(v.string()),
    from: v.string(),
    subject: v.string(),
    body: v.string(),
    processed: v.boolean(),
  }).index("by_trello_card", ["trelloCardId"]),

  // 3.9 Konfiguracja Gmail (multi-account: main / secondary)
  gmailConnection: defineTable({
    accountKey: v.optional(v.union(v.literal("main"), v.literal("secondary"))),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    connectedEmail: v.string(),
    connectedBy: v.string(),
    connectionStatus: v.union(
      v.literal("connected"),
      v.literal("token_expiring"),
      v.literal("refreshing"),
      v.literal("expired"),
      v.literal("refresh_failed"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
  }),

  // 3.9b Aktywne konto Gmail
  gmailSettings: defineTable({
    activeAccountKey: v.union(v.literal("main"), v.literal("secondary")),
  }),

  // 3.11 Klasyfikacja wiadomości Gmail (LEAD / OTHER)
  emailClassifications: defineTable({
    gmailThreadId: v.string(),
    classificationStatus: v.union(v.literal("LEAD"), v.literal("OTHER")),
    classifiedAt: v.number(),
  }).index("by_thread_id", ["gmailThreadId"]),

  // 3.12 Cennik usług
  servicePricing: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    unit: v.string(),
    unitPrice: v.number(),
    vatRate: v.number(),
    isActive: v.boolean(),
    createdBy: v.string(),
  })
    .index("by_active", ["isActive"])
    .index("by_name", ["name"]),

  // 3.13 Pozycje zamówienia
  orderLineItems: defineTable({
    orderId: v.id("orders"),
    serviceId: v.optional(v.id("servicePricing")),
    name: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPrice: v.number(),
    vatRate: v.number(),
    discountPercent: v.optional(v.number()),
    sortOrder: v.number(),
    createdBy: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_order_sort", ["orderId", "sortOrder"]),

  // 3.14 Konfiguracja SMS (singleton)
  smsConfig: defineTable({
    internalPhone: v.string(),
    senderName: v.string(),
  }),

  // 3.15 Konfiguracja CRM (singleton) — m.in. niestandardowe nazwy statusów
  crmConfig: defineTable({
    statusLabels: v.optional(
      v.object({
        lead: v.optional(v.string()),
        inquiry: v.optional(v.string()),
        measurement: v.optional(v.string()),
        offer: v.optional(v.string()),
        contract: v.optional(v.string()),
        production: v.optional(v.string()),
        installation: v.optional(v.string()),
        completed: v.optional(v.string()),
        warranty: v.optional(v.string()),
      }),
    ),
  }),

  // 3.7 Konfiguracja Trello (singleton)
  trelloConfig: defineTable({
    apiKey: v.string(),
    apiToken: v.string(),
    boardId: v.optional(v.string()),
    listId: v.optional(v.string()),
    webhookId: v.optional(v.string()),
    statusListMap: v.optional(
      v.object({
        lead: v.optional(v.string()),
        inquiry: v.optional(v.string()),
        measurement: v.optional(v.string()),
        offer: v.optional(v.string()),
        contract: v.optional(v.string()),
        production: v.optional(v.string()),
        installation: v.optional(v.string()),
        completed: v.optional(v.string()),
        warranty: v.optional(v.string()),
      }),
    ),
    syncEnabled: v.boolean(),
    connectedBy: v.string(),
  }),
});
