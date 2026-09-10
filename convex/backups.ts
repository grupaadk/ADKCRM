/**
 * Moduł backupu, eksportu i przywracania bazy danych dla panelu administratora.
 *
 * Wszystkie funkcje weryfikują rolę 'admin'.
 */
import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireRole } from "./lib/auth";

/**
 * Zwraca podsumowanie statystyk bazy danych (ilość rekordów w tabelach)
 * do wyświetlenia na panelu kopii zapasowych.
 */
export const getBackupStats = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const tableNames = [
      "users",
      "clients",
      "orders",
      "complaints",
      "services",
      "suppliers",
      "documentTemplates",
      "crmConfig",
      "systemLogs",
      "orderTasks",
      "calendarEvents",
      "installationTeams",
      "cars",
      "hrLeaves",
      "aiAssistantConfig",
    ] as const;

    const stats: Record<string, number> = {};
    let totalRecords = 0;

    for (const tableName of tableNames) {
      try {
        const docs = await ctx.db.query(tableName).collect();
        stats[tableName] = docs.length;
        totalRecords += docs.length;
      } catch {
        stats[tableName] = 0;
      }
    }

    return {
      stats,
      totalRecords,
      exportedAt: new Date().toISOString(),
    };
  },
});

/**
 * Eksportuje całą zawartość tabel w bazie danych Convex w formacie struktury JSON.
 */
export const exportFullBackup = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const allTables = [
      "users",
      "clients",
      "orders",
      "orderCounters",
      "documentTemplates",
      "clientEvents",
      "driveConnection",
      "viewConfig",
      "jotformConfig",
      "fakturowniaConfig",
      "clientNotes",
      "pendingJotformSubmissions",
      "gmailConnection",
      "gmailSettings",
      "emailClassifications",
      "services",
      "suppliers",
      "servicePricing",
      "orderLineItems",
      "smsConfig",
      "crmConfig",
      "fakturowniaInvoicesCache",
      "fakturowniaExpensesCache",
      "expenseCategories",
      "complaints",
      "orderAttachments",
      "paymentReminders",
      "taskColumns",
      "orderTasks",
      "taskTemplates",
      "taskLabels",
      "terraceRoofPricing",
      "terraceWallPricing",
      "terraceExtrasPricing",
      "terraceInstallationPricing",
      "taskComments",
      "itKanbanColumns",
      "itKanbanSprints",
      "itKanbanTasks",
      "systemLogs",
      "calendarEventTypes",
      "calendarEvents",
      "installationTeams",
      "cars",
      "carEvents",
      "hrLeaves",
      "hrOvertime",
      "hrLeaveAllowances",
      "aiAssistantConfig",
      "aiPromptComponents",
    ] as const;

    const data: Record<string, unknown[]> = {};
    let totalItems = 0;

    for (const tableName of allTables) {
      try {
        const docs = await ctx.db.query(tableName).collect();
        data[tableName] = docs;
        totalItems += docs.length;
      } catch (err) {
        console.error(`Błąd eksportu tabeli ${tableName}:`, err);
        data[tableName] = [];
      }
    }

    return {
      version: "1.0",
      app: "ADKokna CRM",
      exportedAt: new Date().toISOString(),
      totalRecords: totalItems,
      tablesCount: Object.keys(data).length,
      tables: data,
    };
  },
});

/**
 * Helper do rekursywnej podmiany starych identyfikatorów z pliku backupu na nowe ID wygenerowane w Convex.
 */
function remapIds(obj: unknown, idMap: Map<string, string>): unknown {
  if (typeof obj === "string") {
    return idMap.get(obj) ?? obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => remapIds(item, idMap));
  }
  if (obj !== null && typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      newObj[key] = remapIds(val, idMap);
    }
    return newObj;
  }
  return obj;
}

/**
 * Przywraca całą bazę danych lub zasilanie tabel z podanego pliku kopii zapasowej.
 */
export const restoreFullBackup = mutation({
  args: {
    backupData: v.any(),
    mode: v.union(v.literal("replace"), v.literal("merge")),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireRole(ctx, "admin");

    const backupObj = args.backupData as Record<string, unknown> | null;
    const tables = backupObj?.tables as Record<string, Record<string, unknown>[]> | undefined;
    if (!tables || typeof tables !== "object") {
      throw new ConvexError("Nieprawidłowa struktura pliku kopii zapasowej (brak sekcji tables).");
    }

    const idMap = new Map<string, string>();
    let totalImported = 0;
    const tableCounts: Record<string, number> = {};

    // Kolejność importu - najpierw obiekty nadrzędne, potem podrzędne dla zachowania relacji
    const importOrder = [
      "users",
      "clients",
      "suppliers",
      "documentTemplates",
      "crmConfig",
      "viewConfig",
      "jotformConfig",
      "fakturowniaConfig",
      "gmailSettings",
      "smsConfig",
      "aiAssistantConfig",
      "aiPromptComponents",
      "services",
      "servicePricing",
      "expenseCategories",
      "taskColumns",
      "taskTemplates",
      "taskLabels",
      "calendarEventTypes",
      "installationTeams",
      "cars",
      "orders",
      "pendingJotformSubmissions",
      "clientNotes",
      "clientEvents",
      "orderLineItems",
      "complaints",
      "orderAttachments",
      "paymentReminders",
      "orderTasks",
      "taskComments",
      "calendarEvents",
      "carEvents",
      "hrLeaves",
      "hrOvertime",
      "hrLeaveAllowances",
      "systemLogs",
      "terraceRoofPricing",
      "terraceWallPricing",
      "terraceExtrasPricing",
      "terraceInstallationPricing",
      "itKanbanColumns",
      "itKanbanSprints",
      "itKanbanTasks",
      "fakturowniaInvoicesCache",
      "fakturowniaExpensesCache",
      "orderCounters",
      "driveConnection",
      "gmailConnection",
      "emailClassifications",
    ];

    const tableKeysInBackup = Object.keys(tables);
    const sortedTables = [
      ...importOrder.filter((t) => tableKeysInBackup.includes(t)),
      ...tableKeysInBackup.filter((t) => !importOrder.includes(t)),
    ];

    for (const tableName of sortedTables) {
      const docs = tables[tableName];
      if (!Array.isArray(docs) || docs.length === 0) continue;

      if (args.mode === "replace") {
        try {
          // @ts-expect-error dynamic query
          const existing = await ctx.db.query(tableName).collect();
          for (const item of existing) {
            // Zachowaj zalogowanego usera wykonywującego akcję w tabeli users
            if (tableName === "users" && item._id === adminUser._id) {
              continue;
            }
            await ctx.db.delete(item._id);
          }
        } catch {
          // ignoruj błędy przy pustych/wirtualnych tabelach
        }
      }

      let count = 0;
      for (const doc of docs) {
        if (!doc || typeof doc !== "object") continue;
        const oldId = doc._id as string | undefined;

        // Jeśli to tabela users i user o danym emailu istnieje, pomijamy ponowny insert
        if (tableName === "users" && doc.email) {
          const emailVal = doc.email as string;
          const existingUser = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", emailVal))
            .first();
          if (existingUser) {
            if (oldId) {
              idMap.set(oldId, existingUser._id);
            }
            continue;
          }
        }

        // Czyszczenie pol systemowych (_id, _creationTime)
        const { _id, _creationTime, ...restDoc } = doc;

        // Podmiana relacji w dokumencie
        const mappedDoc = remapIds(restDoc, idMap) as Record<string, unknown>;

        try {
          // @ts-expect-error dynamic insert
          const newId = await ctx.db.insert(tableName, mappedDoc);
          if (oldId) {
            idMap.set(oldId, newId);
          }
          count++;
        } catch (err) {
          console.error(`Błąd importu do tabeli ${tableName}:`, err);
        }
      }

      tableCounts[tableName] = count;
      totalImported += count;
    }

    return {
      success: true,
      totalImported,
      tableCounts,
      idMap: Object.fromEntries(idMap),
    };
  },
});

/**
 * Eksportuje kompletną bazę danych dla wybranego klienta (profil, zlecenia, notatki, zadania, reklamacje, załączniki).
 */
export const exportClientBackup = query({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw new ConvexError("Nie znaleziono wskazanego klienta.");
    }

    // Zlecenia klienta
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const orderIds = new Set(orders.map((o) => o._id));

    // Pozycje kosztorysowe / linijki zleceń
    const orderLineItems = (
      await ctx.db.query("orderLineItems").collect()
    ).filter((item) => orderIds.has(item.orderId));

    // Zadania zleceń
    const orderTasks = (
      await ctx.db.query("orderTasks").collect()
    ).filter((task) => task.orderId && orderIds.has(task.orderId));

    // Notatki klienta i zleceń
    const clientNotes = await ctx.db
      .query("clientNotes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Zdarzenia klienta
    const clientEvents = await ctx.db
      .query("clientEvents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Reklamacje klienta
    const complaints = await ctx.db
      .query("complaints")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Załączniki do zleceń
    const orderAttachments = (
      await ctx.db.query("orderAttachments").collect()
    ).filter((att) => orderIds.has(att.orderId));

    // Wydarzenia w kalendarzu
    const calendarEvents = (
      await ctx.db.query("calendarEvents").collect()
    ).filter(
      (ev) =>
        ev.clientId === args.clientId || (ev.orderId && orderIds.has(ev.orderId))
    );

    const clientName =
      [client.firstName, client.lastName].filter(Boolean).join(" ") ||
      client.companyName ||
      "Klient";

    return {
      version: "1.0",
      type: "single_client_backup",
      exportedAt: new Date().toISOString(),
      client: {
        id: client._id,
        name: clientName,
        companyName: client.companyName,
        email: client.email,
        phone: client.phone,
        nip: client.nip,
      },
      stats: {
        ordersCount: orders.length,
        notesCount: clientNotes.length,
        complaintsCount: complaints.length,
        attachmentsCount: orderAttachments.length,
      },
      tables: {
        clients: [client],
        orders,
        orderLineItems,
        orderTasks,
        clientNotes,
        clientEvents,
        complaints,
        orderAttachments,
        calendarEvents,
      },
    };
  },
});

