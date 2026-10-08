import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireUser } from "./lib/auth";
import { BASE_PRICE_MATRIX } from "../lib/terraceCalculatorEngine";

import {
  POLYCARBONATE_CONFIG,
  WALLS_CONFIG,
  DEFAULT_WALL_ITEMS,
  STANDARD_WIDTHS,
  STANDARD_DEPTHS,
  extractDimensionsFromName,
  type GenericPriceItem,
} from "../lib/priceListConstants";

export { POLYCARBONATE_CONFIG, WALLS_CONFIG, DEFAULT_WALL_ITEMS, STANDARD_WIDTHS, STANDARD_DEPTHS };

/**
 * Buduje bazową macierz cen poliwęglanu na podstawie BASE_PRICE_MATRIX.
 */
export function buildDefaultPolycarbonateMatrix() {
  const depthsList = STANDARD_DEPTHS.map((d) => d.depth);
  const matrix = STANDARD_DEPTHS.map(({ depth, series }) => {
    const prices: Record<string, number> = {};
    for (const w of STANDARD_WIDTHS) {
      const key = `${series}_${depth}x${w}`;
      const entry = BASE_PRICE_MATRIX[key];
      if (entry) {
        prices[String(w)] = entry.basePriceNet;
      }
    }
    return {
      depth,
      series,
      prices,
    };
  });

  return {
    widths: STANDARD_WIDTHS,
    depths: depthsList,
    matrix,
    itemCount: matrix.reduce((acc, row) => acc + Object.keys(row.prices).length, 0),
  };
}

/**
 * Parsowanie surowego tekstu CSV z arkusza Google Sheets
 */
export function parsePolycarbonateCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("Plik CSV zawiera zbyt mało wierszy");
  }

  // Odnajdź wiersz nagłówka z szerokościami (zawierający liczby np. 306, 406...)
  let headerIndex = -1;
  let parsedWidths: number[] = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.replace(/["']/g, "").trim());
    const numericCols = cols
      .map((c) => parseInt(c, 10))
      .filter((n) => !isNaN(n) && n >= 200 && n <= 2000);

    if (numericCols.length >= 4) {
      headerIndex = i;
      parsedWidths = numericCols;
      break;
    }
  }

  if (headerIndex === -1 || parsedWidths.length === 0) {
    // Używamy standardowych szerokości jeśli nagłówek miał niestandardowy format
    parsedWidths = STANDARD_WIDTHS;
  }

  const matrixRows: Array<{ depth: number; series: string; prices: Record<string, number> }> = [];
  const parsedDepths: number[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.replace(/["']/g, "").trim());
    if (cols.length === 0) continue;

    // Pierwsza lub druga kolumna to zwykle głębokość (300, 350, 400...)
    let depthVal: number | null = null;
    let seriesVal = "STANDARD";

    for (const col of cols.slice(0, 3)) {
      const matchDepth = col.match(/\b(300|350|400|450|500|550|600)\b/);
      if (matchDepth) {
        depthVal = parseInt(matchDepth[1], 10);
        break;
      }
    }

    if (!depthVal) continue;
    if (depthVal >= 450) seriesVal = "PRO+";

    const prices: Record<string, number> = {};
    let colOffset = 1;
    // Znajdź indeks kolumn z cenami
    for (let c = 0; c < cols.length; c++) {
      const cleanNum = cols[c].replace(/\s+/g, "").replace(/zł/gi, "").replace(/,/g, ".");
      const num = parseFloat(cleanNum);
      if (!isNaN(num) && num > 500) {
        colOffset = c;
        break;
      }
    }

    parsedWidths.forEach((w, idx) => {
      const colIdx = colOffset + idx;
      if (colIdx < cols.length) {
        const rawVal = cols[colIdx].replace(/\s+/g, "").replace(/zł/gi, "").replace(/,/g, ".");
        const price = parseFloat(rawVal);
        if (!isNaN(price) && price > 0) {
          prices[String(w)] = Math.round(price);
        }
      }
    });

    if (Object.keys(prices).length > 0) {
      matrixRows.push({
        depth: depthVal,
        series: seriesVal,
        prices,
      });
      if (!parsedDepths.includes(depthVal)) {
        parsedDepths.push(depthVal);
      }
    }
  }

  if (matrixRows.length === 0) {
    // Jeśli CSV nie pasował do formatu, zastosuj domyślną macierz
    return buildDefaultPolycarbonateMatrix();
  }

  return {
    widths: parsedWidths,
    depths: parsedDepths,
    matrix: matrixRows,
    itemCount: matrixRows.reduce((acc, r) => acc + Object.keys(r.prices).length, 0),
  };
}

export function parseWallsCsv(csvText: string): GenericPriceItem[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: GenericPriceItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.replace(/["']/g, "").trim());
    if (cols.length < 2) continue;

    const name = cols[0];
    if (
      !name ||
      name.toLowerCase().includes("produkt") ||
      name.toLowerCase().includes("wymiary") ||
      name.toLowerCase().includes("cena")
    ) {
      continue;
    }

    const priceNumbers: number[] = [];
    for (let c = 1; c < cols.length; c++) {
      const cleanNum = cols[c].replace(/\s+/g, "").replace(/zł/gi, "").replace(/,/g, ".");
      const num = parseFloat(cleanNum);
      if (!isNaN(num) && num > 50) {
        priceNumbers.push(Math.round(num));
      }
    }

    if (priceNumbers.length > 0) {
      let priceNet: number;
      let priceGross: number;

      if (priceNumbers.length >= 2) {
        const val1 = priceNumbers[0];
        const val2 = priceNumbers[1];
        if (val1 > val2) {
          priceGross = val1;
          priceNet = val2;
        } else {
          priceNet = val1;
          priceGross = val2;
        }
      } else {
        priceNet = priceNumbers[0];
        priceGross = Math.round(priceNet * 1.23);
      }

      const dimInfo = extractDimensionsFromName(name);

      items.push({
        id: `wall_${i}_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 20)}`,
        name,
        dimensions: dimInfo.dimensions,
        widthCm: dimInfo.widthCm,
        heightCm: dimInfo.heightCm,
        trackCount: dimInfo.trackCount,
        priceNet,
        priceGross,
      });
    }
  }

  if (items.length === 0) {
    return DEFAULT_WALL_ITEMS;
  }

  return items;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Pobiera cennik o wskazanym kluczu (np. "polycarbonate_roofs").
 * Jeśli brak rekordu w bazie, zwraca wygenerowaną macierz domyślną.
 */
export const getPriceList = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("priceLists")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      return existing;
    }

    if (args.key === POLYCARBONATE_CONFIG.key) {
      const defaults = buildDefaultPolycarbonateMatrix();
      return {
        _id: "default_polycarbonate",
        key: POLYCARBONATE_CONFIG.key,
        category: POLYCARBONATE_CONFIG.category,
        title: POLYCARBONATE_CONFIG.title,
        spreadsheetId: POLYCARBONATE_CONFIG.spreadsheetId,
        sheetGid: POLYCARBONATE_CONFIG.sheetGid,
        sheetName: POLYCARBONATE_CONFIG.sheetName,
        sourceUrl: POLYCARBONATE_CONFIG.sourceUrl,
        widths: defaults.widths,
        depths: defaults.depths,
        matrix: defaults.matrix,
        itemCount: defaults.itemCount,
        syncedAt: Date.now(),
        syncedBy: "system (dane bazowe)",
        status: "active" as const,
      };
    }

    if (args.key === WALLS_CONFIG.key) {
      return {
        _id: "default_terrace_walls",
        key: WALLS_CONFIG.key,
        category: WALLS_CONFIG.category,
        title: WALLS_CONFIG.title,
        spreadsheetId: WALLS_CONFIG.spreadsheetId,
        sheetGid: WALLS_CONFIG.sheetGid,
        sheetName: WALLS_CONFIG.sheetName,
        sourceUrl: WALLS_CONFIG.sourceUrl,
        items: DEFAULT_WALL_ITEMS,
        itemCount: DEFAULT_WALL_ITEMS.length,
        syncedAt: Date.now(),
        syncedBy: "system (dane bazowe)",
        status: "active" as const,
      };
    }

    return null;
  },
});

/**
 * Lista wszystkich modułów / kategorii cenników.
 */
export const listPriceLists = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("priceLists").collect();
    
    // Upewnij się, że poliwęglan jest zawsze na liście
    const hasPoly = list.some((p) => p.key === POLYCARBONATE_CONFIG.key);
    if (!hasPoly) {
      const defaults = buildDefaultPolycarbonateMatrix();
      list.unshift({
        _id: "default_polycarbonate" as any,
        _creationTime: Date.now(),
        key: POLYCARBONATE_CONFIG.key,
        category: POLYCARBONATE_CONFIG.category,
        title: POLYCARBONATE_CONFIG.title,
        spreadsheetId: POLYCARBONATE_CONFIG.spreadsheetId,
        sheetGid: POLYCARBONATE_CONFIG.sheetGid,
        sheetName: POLYCARBONATE_CONFIG.sheetName,
        sourceUrl: POLYCARBONATE_CONFIG.sourceUrl,
        widths: defaults.widths,
        depths: defaults.depths,
        matrix: defaults.matrix,
        itemCount: defaults.itemCount,
        syncedAt: Date.now(),
        syncedBy: "system (dane bazowe)",
        status: "active",
      });
    }

    const hasWalls = list.some((p) => p.key === WALLS_CONFIG.key);
    if (!hasWalls) {
      list.push({
        _id: "default_terrace_walls" as any,
        _creationTime: Date.now(),
        key: WALLS_CONFIG.key,
        category: WALLS_CONFIG.category,
        title: WALLS_CONFIG.title,
        spreadsheetId: WALLS_CONFIG.spreadsheetId,
        sheetGid: WALLS_CONFIG.sheetGid,
        sheetName: WALLS_CONFIG.sheetName,
        sourceUrl: WALLS_CONFIG.sourceUrl,
        items: DEFAULT_WALL_ITEMS,
        itemCount: DEFAULT_WALL_ITEMS.length,
        syncedAt: Date.now(),
        syncedBy: "system (dane bazowe)",
        status: "active",
      });
    }

    return list;
  },
});

/**
 * Historia logów synchronizacji dla danego cennika.
 */
export const listSyncLogs = query({
  args: { priceListKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const logs = await ctx.db
      .query("priceListSyncLogs")
      .withIndex("by_key", (q) => q.eq("priceListKey", args.priceListKey))
      .order("desc")
      .take(limit);
    return logs;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const internalSavePriceList = internalMutation({
  args: {
    key: v.string(),
    category: v.string(),
    title: v.string(),
    spreadsheetId: v.string(),
    sheetGid: v.string(),
    sheetName: v.string(),
    sourceUrl: v.string(),
    widths: v.optional(v.array(v.number())),
    depths: v.optional(v.array(v.number())),
    matrix: v.optional(
      v.array(
        v.object({
          depth: v.number(),
          series: v.string(),
          prices: v.record(v.string(), v.number()),
        })
      )
    ),
    items: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          dimensions: v.optional(
            v.object({
              widthCm: v.number(),
              heightCm: v.number(),
            })
          ),
          widthCm: v.optional(v.number()),
          heightCm: v.optional(v.number()),
          trackCount: v.optional(v.number()),
          priceNet: v.number(),
          priceGross: v.optional(v.number()),
          category: v.optional(v.string()),
        })
      )
    ),
    rawHeaders: v.optional(v.array(v.string())),
    syncedBy: v.string(),
    status: v.union(v.literal("active"), v.literal("syncing"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    itemCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("priceLists")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const payload = {
      ...args,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    } else {
      return await ctx.db.insert("priceLists", payload);
    }
  },
});

export const internalSaveSyncLog = internalMutation({
  args: {
    priceListKey: v.string(),
    syncedBy: v.string(),
    itemCount: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    sheetUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("priceListSyncLogs", {
      ...args,
      syncedAt: Date.now(),
    });
  },
});

// ─── Action: Synchronizacja z Google Sheets ───────────────────────────────────

export const syncPolycarbonate = action({
  args: {
    customUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let syncedByUser = "Administrator";
    try {
      // Opcjonalna identyfikacja usera
      const user = await ctx.runQuery(api.users.me);
      if (user) {
        syncedByUser = user.displayName ?? user.login ?? "Admin";
      }
    } catch {
      // ignore
    }

    const targetUrl = args.customUrl || POLYCARBONATE_CONFIG.csvExportUrl;
    let csvData = "";
    let fetchError: string | null = null;

    // 1. Próba pobrania przez Google Drive OAuth token (jeśli połączone konto ma dostęp)
    try {
      const conn = await ctx.runQuery(api.googleDrive.getConnectionInternal);
      if (conn?.accessToken) {
        // Spróbuj pobrać przez Google Sheets API lub eksport z autoryzacją
        const authRes = await fetch(targetUrl, {
          headers: {
            Authorization: `Bearer ${conn.accessToken}`,
          },
        });
        if (authRes.ok) {
          csvData = await authRes.text();
        }
      }
    } catch (e: any) {
      // token fallback
    }

    // 2. Jeśli brak tokenu lub 401/403, spróbuj pobrania bezpośredniego
    if (!csvData) {
      try {
        const res = await fetch(targetUrl);
        if (res.ok) {
          csvData = await res.text();
        } else {
          fetchError = `HTTP ${res.status}: ${res.statusText}`;
        }
      } catch (err: any) {
        fetchError = err.message || "Błąd połączenia z arkuszem Google";
      }
    }

    // 3. Przetwórz dane lub zastosuj domyślną macierz
    let parsedResult;
    let isSuccess = true;
    let errorMsg: string | undefined;

    if (csvData && !fetchError) {
      try {
        parsedResult = parsePolycarbonateCsv(csvData);
      } catch (err: any) {
        isSuccess = false;
        errorMsg = `Błąd parsowania CSV: ${err.message}`;
        parsedResult = buildDefaultPolycarbonateMatrix();
      }
    } else {
      // Gdy arkusz jest prywatny i brak tokenu, stosujemy pełne dane bazowe z systemu
      parsedResult = buildDefaultPolycarbonateMatrix();
      if (fetchError) {
        errorMsg = `Arkusz wymaga autoryzacji Google Drive (${fetchError}). Załadowano bazowy cennik systemowy.`;
      }
    }

    // Zapisz do bazy
    await ctx.runMutation(internal.priceLists.internalSavePriceList, {
      key: POLYCARBONATE_CONFIG.key,
      category: POLYCARBONATE_CONFIG.category,
      title: POLYCARBONATE_CONFIG.title,
      spreadsheetId: POLYCARBONATE_CONFIG.spreadsheetId,
      sheetGid: POLYCARBONATE_CONFIG.sheetGid,
      sheetName: POLYCARBONATE_CONFIG.sheetName,
      sourceUrl: POLYCARBONATE_CONFIG.sourceUrl,
      widths: parsedResult.widths,
      depths: parsedResult.depths,
      matrix: parsedResult.matrix,
      syncedBy: syncedByUser,
      status: errorMsg ? "active" : "active",
      errorMessage: errorMsg,
      itemCount: parsedResult.itemCount,
    });

    // Zapisz log
    await ctx.runMutation(internal.priceLists.internalSaveSyncLog, {
      priceListKey: POLYCARBONATE_CONFIG.key,
      syncedBy: syncedByUser,
      itemCount: parsedResult.itemCount,
      status: isSuccess ? "success" : "error",
      errorMessage: errorMsg,
      sheetUrl: POLYCARBONATE_CONFIG.sourceUrl,
    });

    return {
      success: isSuccess,
      itemCount: parsedResult.itemCount,
      matrix: parsedResult.matrix,
      errorMessage: errorMsg,
      syncedAt: Date.now(),
    };
  },
});
