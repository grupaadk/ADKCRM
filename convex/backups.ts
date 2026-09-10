/**
 * Moduł backupu i eksportu bazy danych dla panelu administratora.
 *
 * Wszystkie funkcje weryfikują rolę 'admin'.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
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
