import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Role użytkowników wewnętrznych
export const USER_ROLES = ["admin", "sales", "montaz"] as const;
export type UserRole = (typeof USER_ROLES)[number];
const userRole = v.union(
  v.literal("admin"),
  v.literal("sales"),
  v.literal("montaz"),
);

// Status workflow wg PRD sekcja 3.1
export const CLIENT_STATUSES = [
  "lead",
  "inquiry",
  "measurement",
  "offer",
  "contract",
  "production",
  "installation",
  "complaint",
  "completed",
  "archived",
] as const;

// Dozwolone przejścia statusów wg PRD US-2.1
// Każdy status (poza "archived") może zostać zarchiwizowany — przejście wykonuje przycisk "Archiwizuj".
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  lead: ["inquiry", "measurement", "archived"],
  inquiry: ["measurement", "offer", "archived"],
  measurement: ["offer", "contract", "archived"],
  offer: ["contract", "lead", "archived"],
  contract: ["production", "archived"],
  production: ["installation", "archived"],
  installation: ["completed", "complaint", "archived"],
  completed: ["archived"],
  complaint: ["completed", "archived"],
  archived: ["completed"],
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
  "Inne",
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
  v.literal("complaint"),
  v.literal("archived"),
);

const documentEntry = v.object({
  enabled: v.boolean(),
  url: v.optional(v.string()),
  generatedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  errorAt: v.optional(v.number()),
  signatureStatus: v.optional(v.union(v.literal("signed"), v.literal("not_applicable"))),
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
  kind: v.union(v.literal("advance"), v.literal("final"), v.literal("vat")),
  remoteId: v.optional(v.string()),
  number: v.optional(v.string()),
  grossAmount: v.optional(v.number()),
  advancePercent: v.optional(v.number()),
  createdAt: v.number(),
});

const fakturowniaOrderLink = v.object({
  estimateId: v.optional(v.string()),
  estimateNumber: v.optional(v.string()),
  oid: v.optional(v.string()),
  estimateSyncedAt: v.optional(v.number()),
  invoices: v.array(fakturowniaInvoiceEntry),
});

export default defineSchema({
  // Convex Auth tables (sessions, accounts, refresh tokens, verification codes, etc.)
  // Rozszerzamy users o pola wewnętrzne: role, isActive, displayName.
  // Pole `email` z authTables przechowuje login (username) — Password provider
  // używa tego pola jako identyfikatora konta.
  ...authTables,
  users: defineTable({
    // Pola z authTables.users:
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()), // login (username)
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Pola wewnętrzne:
    role: v.optional(userRole),
    isActive: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
    showInPickers: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // 3.1 Klient — tylko dane kontaktowe
  clients: defineTable({
    clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nip: v.optional(v.string()),
    companyName: v.optional(v.string()),
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
    jotformSubmissionId: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    // Legacy color fields (exist in old documents, not used by UI/mutations)
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
    customText: v.optional(v.string()),

    // Dane zlecenia
    services: v.optional(v.array(v.string())),
    // Legacy color fields (exist in old documents, not used by UI/mutations)
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),

    // Lokalizacja inwestycji
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),

    // Status workflow
    status: clientStatus,
    productionDate: v.optional(v.number()),
    completionDate: v.optional(v.number()),
    serviceDeliveries: v.optional(v.array(v.object({
      serviceName: v.string(),
      supplierId: v.id("suppliers"),
      orderDate: v.optional(v.number()),
      deliveryDate: v.optional(v.number()),
    }))),

    // Dokumenty
    documents: documentSet,

    // Karty gwarancyjne producentów
    warrantyCards: v.optional(v.array(warrantyCard)),

    // Dokumenty gwarancji — dowolne klucze (poza stałym gwarancja_alco w documents)
    warrantyDocs: v.optional(v.record(v.string(), documentEntry)),

    // Google Drive
    folderId: v.optional(v.string()),
    folderUrl: v.optional(v.string()),
    driveProjectFiles: v.optional(v.array(v.object({
      fileId: v.string(),
      name: v.string(),
      url: v.string(),
    }))),
    attachmentsFolderId: v.optional(v.string()),

    // Przypisany użytkownik
    assignedUserId: v.optional(v.id("users")),

    // Metadane
    source: v.union(v.literal("jotform"), v.literal("manual")),
    jotformSubmissionId: v.optional(v.string()),
    createdBy: v.string(),

    // Plan fakturowania (VAT / zaliczka + końcowa)
    invoicePlan: v.optional(v.object({
      type: v.optional(v.union(v.literal("vat"), v.literal("advance_final"))),
      advancePct: v.number(),
    })),

    // Fakturownia (zamówienie = estimate + faktury zaliczkowa / końcowa)
    fakturownia: v.optional(fakturowniaOrderLink),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_production_date", ["productionDate"])
    .index("by_completion_date", ["completionDate"])
    .index("by_jotform_submission", ["jotformSubmissionId"]),

  // 3.1c Liczniki numeracji zleceń (per miesiąc)
  orderCounters: defineTable({
    year: v.number(),
    month: v.number(),
    lastNumber: v.number(),
  }).index("by_year_month", ["year", "month"]),

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

  // 3.8 Oczekujące zgłoszenia z JotForm (klient tworzony od razu, zlecenie tworzone przy przesunięciu do "Do pomiarów")
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
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    // Legacy color fields (exist in old documents, not used by UI/mutations)
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    driveProjectFiles: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
    }))),
    comment: v.optional(v.string()),
    customText: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    clientFolderId: v.optional(v.string()),
    clientFolderUrl: v.optional(v.string()),
    clientFolderCreatedAt: v.optional(v.number()),
    stage: v.optional(v.union(v.literal("lead"), v.literal("inquiry"))),
    processed: v.boolean(),
    archived: v.optional(v.boolean()),
    offerSentAt: v.optional(v.number()),
    opportunityFolderId: v.optional(v.string()),
    opportunityFolderUrl: v.optional(v.string()),
    valuationFilesFolderId: v.optional(v.string()),
    offersReceivedFolderId: v.optional(v.string()),
    offersSentFolderId: v.optional(v.string()),
    ponzioFilesFolderId: v.optional(v.string()),
    otherFilesFolderId: v.optional(v.string()),
    assignedUserId: v.optional(v.id("users")),
  })
    .index("by_client", ["clientId"])
    .index("by_submission", ["submissionId"])
    .index("by_assignee", ["assignedUserId"]),

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

  // 3.12 Usługi — dynamiczna lista kategorii (zastępuje SERVICES)
  services: defineTable({
    name: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    description: v.optional(v.string()),
    supplierIds: v.optional(v.array(v.id("suppliers"))),
    // Pola legacy — do usunięcia po migracji
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    requiresColor: v.optional(v.boolean()),
    createdBy: v.string(),
  })
    .index("by_active_sort", ["isActive", "sortOrder"]),

  // 3.12a Dostawcy
  suppliers: defineTable({
    name: v.string(),
    isActive: v.boolean(),
    createdBy: v.string(),
  })
    .index("by_active", ["isActive"]),

  // 3.12b Cennik usług (legacy — pozycje do wyceny)
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
    recipients: v.optional(v.array(v.object({ name: v.string(), phone: v.string() }))),
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
        complaint: v.optional(v.string()),
        archived: v.optional(v.string()),
      }),
    ),
  }),

  // 3.16 Cache faktur z Fakturowni
  fakturowniaInvoicesCache: defineTable({
    remoteId: v.string(),
    number: v.optional(v.string()),
    kind: v.string(),
    status: v.optional(v.string()),
    buyerName: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    sellDate: v.optional(v.string()),
    paymentTo: v.optional(v.string()),
    grossAmount: v.optional(v.number()),
    netAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    oid: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),
    syncedAt: v.number(),
  })
    .index("by_remote_id", ["remoteId"])
    .index("by_order", ["orderId"])
    .index("by_synced", ["syncedAt"]),

  // 3.17 Reklamacje
  complaints: defineTable({
    orderId: v.id("orders"),
    clientId: v.id("clients"),
    status: v.union(v.literal("w_toku"), v.literal("zakonczona")),
    description: v.optional(v.string()),
    notes: v.optional(v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        createdAt: v.number(),
        createdBy: v.string(),
      }),
    )),
    todos: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        completed: v.boolean(),
      }),
    ),
    entries: v.optional(v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        createdAt: v.number(),
        createdBy: v.string(),
        type: v.union(v.literal("note"), v.literal("todo")),
        completed: v.optional(v.boolean()),
      }),
    )),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    createdBy: v.string(),
    complaintFolderId: v.optional(v.string()),
    complaintFolderUrl: v.optional(v.string()),
  })
    .index("by_order", ["orderId"])
    .index("by_client", ["clientId"]),

  // 3.18 Załączniki do zleceń (pliki w folderze "Załączniki" w Google Drive)
  orderAttachments: defineTable({
    orderId: v.id("orders"),
    fileId: v.string(),
    name: v.string(),
    url: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    folderPath: v.optional(v.string()),
    uploadedAt: v.number(),
    uploadedBy: v.string(),
  }).index("by_order", ["orderId"]),

  // 3.19 Historia przypomnień o płatności (windykacja)
  paymentReminders: defineTable({
    invoiceId: v.id("fakturowniaInvoicesCache"),
    orderId: v.optional(v.id("orders")),
    clientId: v.id("clients"),
    sentAt: v.number(),
    recipientEmail: v.string(),
    sentBy: v.string(),
    invoiceNumber: v.optional(v.string()),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_order", ["orderId"]),

  // 3.20 Zadania (TODO lista) — należą do zlecenia, szansy sprzedaży ALBO reklamacji.
  // Dokładnie jedno z pól orderId / opportunityId / complaintId jest ustawione.
  orderTasks: defineTable({
    orderId: v.optional(v.id("orders")),
    opportunityId: v.optional(v.id("pendingJotformSubmissions")),
    complaintId: v.optional(v.id("complaints")),
    title: v.string(),
    dueDate: v.optional(v.number()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    assignedUserId: v.optional(v.id("users")),
    createdBy: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_opportunity", ["opportunityId"])
    .index("by_complaint", ["complaintId"])
    .index("by_assignee", ["assignedUserId"]),

  // 3.21 Komentarze do zadań
  taskComments: defineTable({
    taskId: v.id("orderTasks"),
    body: v.string(),
    authorId: v.id("users"),
  }).index("by_task", ["taskId"]),

  // Logi systemowe
  systemLogs: defineTable({
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    source: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
  })
    .index("by_source", ["source"])
    .index("by_level", ["level"]),
});
