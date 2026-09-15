import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export type SearchEntityType = "klienci" | "zlecenia" | "szanse" | "zadania" | "reklamacje";

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  details?: string;
  status?: {
    label: string;
    variant: "default" | "success" | "warning" | "info" | "secondary" | "danger";
  };
  customText?: string;
  tags?: string[];
  url: string;
  score: number;
  snippet?: string;
}

const POLISH_CHAR_MAP: Record<string, string> = {
  ą: "a", Ą: "a",
  ć: "c", Ć: "c",
  ę: "e", Ę: "e",
  ł: "l", Ł: "l",
  ń: "n", Ń: "n",
  ó: "o", Ó: "o",
  ś: "s", Ś: "s",
  ź: "z", Ź: "z",
  ż: "z", Ż: "z",
};

export function normalizeText(text: string): string {
  if (!text) return "";
  const str = text.toLowerCase();
  let normalized = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    normalized += POLISH_CHAR_MAP[char] || char;
  }
  return normalized;
}

export function normalizeDigitsOnly(text: string): string {
  if (!text) return "";
  return text.replace(/\D/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length > b.length) {
    [a, b] = [b, a];
  }
  if (a.length === 0) return b.length;

  let v0 = new Array(a.length + 1);
  let v1 = new Array(a.length + 1);

  for (let i = 0; i <= a.length; i++) v0[i] = i;

  for (let i = 0; i < b.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < a.length; j++) {
      const cost = (a[j] === b[i]) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= a.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v1[a.length];
}

function calculateScore(
  queryNorm: string,
  queryAlpha: string,
  queryTokens: string[],
  digitsNorm: string,
  fields: { text: string; weight: number; isDigits?: boolean }[]
): { score: number; snippet?: string } {
  let totalScore = 0;
  let bestSnippet: string | undefined = undefined;

  for (const field of fields) {
    if (!field.text) continue;
    const fieldNorm = normalizeText(field.text);
    const fieldAlpha = fieldNorm.replace(/[^a-z0-9]/g, "");
    const fieldTokens = fieldNorm.split(/[^a-z0-9]+/).filter(Boolean);

    let fieldScore = 0;

    // 1. Exact/StartsWith match on raw normalized string
    if (fieldNorm === queryNorm) {
      fieldScore += field.weight * 10;
    } else if (fieldNorm.startsWith(queryNorm)) {
      fieldScore += field.weight * 5;
    } else if (fieldNorm.includes(queryNorm)) {
      fieldScore += field.weight * 2;
    }

    // 2. Alphanumeric match (handles "weskadbud" vs "weskad-bud" or "weskad bud")
    if (queryAlpha.length >= 3 && fieldAlpha === queryAlpha) {
      fieldScore += field.weight * 8;
    } else if (queryAlpha.length >= 3 && fieldAlpha.includes(queryAlpha)) {
      fieldScore += field.weight * 4;
    }

    // 3. Token-based fuzzy match
    for (const qToken of queryTokens) {
      if (qToken.length < 3) continue;

      for (const fToken of fieldTokens) {
        if (fToken === qToken) {
          fieldScore += field.weight * 2;
        } else if (fToken.includes(qToken)) {
          fieldScore += field.weight * 1;
        } else {
          // Typo tolerance (Fuzzy match)
          if (Math.abs(fToken.length - qToken.length) <= 2) {
            const dist = levenshteinDistance(qToken, fToken);
            if (dist <= 1 && qToken.length >= 4) {
              fieldScore += field.weight * 1.5;
            } else if (dist <= 2 && qToken.length >= 6) {
              fieldScore += field.weight * 1;
            }
          }
        }
      }
    }

    // 4. Digits match (e.g. for phones/NIP)
    if (field.isDigits && digitsNorm.length >= 3) {
      const fieldDigits = normalizeDigitsOnly(field.text);
      if (fieldDigits.includes(digitsNorm)) {
        fieldScore += field.weight * 4;
      }
    }

    if (fieldScore > 0) {
      totalScore += fieldScore;
      if (!bestSnippet) bestSnippet = field.text;
    }
  }

  return { score: totalScore, snippet: bestSnippet };
}

function getClientStatusVariant(
  status: string
): "default" | "success" | "warning" | "info" | "secondary" | "danger" {
  switch (status) {
    case "lead":
    case "inquiry":
      return "info";
    case "completed":
      return "success";
    case "archived":
      return "secondary";
    default:
      return "default";
  }
}

function getOrderStatusVariant(
  status: string
): "default" | "success" | "warning" | "info" | "secondary" | "danger" {
  switch (status) {
    case "zrobione":
    case "zakonczone":
    case "gotowe":
      return "success";
    case "produkcja":
    case "montaz":
      return "info";
    case "wstrzymane":
    case "reklamacja":
      return "danger";
    case "archived":
      return "secondary";
    default:
      return "default";
  }
}

export const querySearch = query({
  args: {
    query: v.string(),
    types: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const rawQuery = args.query.trim();
    if (!rawQuery) {
      return [];
    }

    let searchTypes: string[] = args.types ?? ["klienci", "zlecenia", "szanse", "zadania", "reklamacje"];
    let cleanQuery = rawQuery;

    if (rawQuery.toLowerCase().startsWith("k:")) {
      searchTypes = ["klienci"];
      cleanQuery = rawQuery.slice(2).trim();
    } else if (rawQuery.toLowerCase().startsWith("z:")) {
      searchTypes = ["zlecenia"];
      cleanQuery = rawQuery.slice(2).trim();
    } else if (rawQuery.toLowerCase().startsWith("s:")) {
      searchTypes = ["szanse"];
      cleanQuery = rawQuery.slice(2).trim();
    } else if (rawQuery.toLowerCase().startsWith("zad:")) {
      searchTypes = ["zadania"];
      cleanQuery = rawQuery.slice(4).trim();
    } else if (rawQuery.toLowerCase().startsWith("r:") || rawQuery.toLowerCase().startsWith("rek:")) {
      searchTypes = ["reklamacje"];
      cleanQuery = rawQuery.replace(/^(r:|rek:)/i, "").trim();
    }

    if (!cleanQuery) {
      return [];
    }

    const queryNorm = normalizeText(cleanQuery);
    const queryAlpha = queryNorm.replace(/[^a-z0-9]/g, "");
    const queryTokens = queryNorm.split(/[^a-z0-9]+/).filter(Boolean);
    const digitsNorm = normalizeDigitsOnly(cleanQuery);
    const maxLimit = args.limit ?? 20;
    const results: SearchResultItem[] = [];

    // Fetch dynamic status labels
    const crmConfig = await ctx.db.query("crmConfig").first();
    const statusMap = new Map<string, string>();
    if (crmConfig?.statuses) {
      for (const st of crmConfig.statuses) {
        statusMap.set(st.key, st.label);
      }
    }
    const formatStatus = (key: string) => {
      if (key === "archived") return "Archiwum";
      if (statusMap.has(key)) return statusMap.get(key)!;
      const defaults: Record<string, string> = {
        lead: "Lead", inquiry: "Zapytanie", measurement: "Pomiar",
        offer: "Oferta", contract: "Umowa", production: "Produkcja",
        installation: "Montaż", completed: "Zrobione", complaint: "Reklamacja"
      };
      return defaults[key] || key.charAt(0).toUpperCase() + key.slice(1);
    };

    // 1. Search Klienci
    if (searchTypes.includes("klienci")) {
      const clients = await ctx.db.query("clients").collect();

      for (const c of clients) {
        const fields = [
          { text: c.firstName, weight: 8 },
          { text: c.lastName, weight: 10 },
          { text: c.companyName ?? "", weight: 9 },
          { text: c.phone ?? "", weight: 7, isDigits: true },
          { text: c.email ?? "", weight: 7 },
          { text: c.nip ?? "", weight: 7, isDigits: true },
          { text: c.city ?? "", weight: 5 },
          { text: c.street ?? "", weight: 5 },
          { text: c.comment ?? "", weight: 3 },
        ];

        const { score, snippet } = calculateScore(queryNorm, queryAlpha, queryTokens, digitsNorm, fields);

        if (score > 0) {
          const clientName = [c.firstName, c.lastName].filter(Boolean).join(" ");
          const subtitleParts = [c.companyName, c.city].filter(Boolean);

          const tags: string[] = [];
          if (c.nip) tags.push(`NIP: ${c.nip}`);
          if (c.email) tags.push(`📧 ${c.email}`);
          if (c.source) tags.push(`Źródło: ${c.source}`);
          if (c._creationTime) tags.push(`Dodano: ${new Date(c._creationTime).toLocaleDateString("pl-PL")}`);

          results.push({
            id: c._id,
            type: "klienci",
            title: clientName || c.companyName || "Brak nazwy",
            subtitle: subtitleParts.join(" • "),
            details: c.phone ? `📞 ${c.phone}` : undefined,
            tags,
            status: c.status ? {
              label: formatStatus(c.status),
              variant: getClientStatusVariant(c.status),
            } : undefined,
            url: `/admin/klient/${c._id}`,
            score,
            snippet,
          });
        }
      }
    }

    // 2. Search Orders
    if (searchTypes.includes("zlecenia")) {
      const orders = await ctx.db.query("orders").collect();
      const clients = await ctx.db.query("clients").collect();
      const clientMap = new Map(clients.map(c => [c._id, c]));
      const teams = await ctx.db.query("installationTeams").collect();
      const teamMap = new Map(teams.map(t => [t._id, t]));

      for (const o of orders) {
        const client = clientMap.get(o.clientId);
        const clientName = client ? [client.firstName, client.lastName].filter(Boolean).join(" ") : "";
        const clientCompany = client?.companyName ?? "";
        
        const team = o.installationTeamId ? teamMap.get(o.installationTeamId) : null;
        const teamName = team ? team.name : "";

        const alcoNumbers = (o.serviceDeliveries ?? [])
          .map((d) => d.externalOrderNumber)
          .filter((n): n is string => Boolean(n));
        const alcoIds = (o.serviceDeliveries ?? [])
          .map((d) => d.externalOrderId)
          .filter((id): id is string => Boolean(id));

        const fields = [
          { text: o.name ?? "", weight: 10 },
          { text: o.customText ?? "", weight: 8 },
          { text: clientName, weight: 9 },
          { text: clientCompany, weight: 9 },
          { text: teamName, weight: 8 },
          { text: client?.phone ?? "", weight: 6, isDigits: true },
          { text: o.investmentCity ?? "", weight: 5 },
          { text: o.investmentStreet ?? "", weight: 5 },
          { text: o.comment ?? "", weight: 3 },
          ...alcoNumbers.map((num) => ({ text: num, weight: 10 })),
          ...alcoIds.map((id) => ({ text: id, weight: 10 })),
        ];

        const { score, snippet } = calculateScore(queryNorm, queryAlpha, queryTokens, digitsNorm, fields);

        if (score > 0) {
          const addr = [o.investmentStreet, o.investmentCity].filter(Boolean).join(" ");
          
          const tags: string[] = [];
          if (alcoNumbers.length > 0) tags.push(`ALCO: ${alcoNumbers.join(", ")}`);
          if (teamName) tags.push(`Ekipa: ${teamName}`);
          if (o.installationStartDate) tags.push(`Montaż: ${new Date(o.installationStartDate).toLocaleDateString("pl-PL")}`);
          if (o._creationTime) tags.push(`Dodano: ${new Date(o._creationTime).toLocaleDateString("pl-PL")}`);

          results.push({
            id: o._id,
            type: "zlecenia",
            title: o.name || "Zlecenie",
            subtitle: (clientName || clientCompany || "Brak klienta") + (addr ? ` • ${addr}` : ""),
            customText: o.customText || undefined,
            tags,
            status: {
              label: formatStatus(o.status),
              variant: getOrderStatusVariant(o.status),
            },
            url: `/admin/klient/${o.clientId}/zlecenie/${o._id}`,
            score,
            snippet,
          });
        }
      }
    }

    // 3. Search Szanse Sprzedaży (pendingJotformSubmissions)
    if (searchTypes.includes("szanse")) {
      const opps = await ctx.db.query("pendingJotformSubmissions").collect();

      for (const o of opps) {
        const fields = [
          { text: o.firstName ?? "", weight: 8 },
          { text: o.lastName ?? "", weight: 10 },
          { text: o.phone ?? "", weight: 6, isDigits: true },
          { text: o.email ?? "", weight: 6 },
          { text: o.city ?? "", weight: 5 },
          { text: o.street ?? "", weight: 4 },
          { text: o.comment ?? "", weight: 3 },
          { text: o.customText ?? "", weight: 3 },
        ];

        const { score, snippet } = calculateScore(queryNorm, queryAlpha, queryTokens, digitsNorm, fields);

        if (score > 0) {
          const clientName = [o.firstName, o.lastName].filter(Boolean).join(" ");
          const addr = [o.street, o.city].filter(Boolean).join(" ");
          
          const tags: string[] = [];
          if (o.price) tags.push(`Szacunek: ${o.price} zł`);
          if (o.stage) tags.push(`Etap: ${o.stage}`);
          if (o._creationTime) tags.push(`Dodano: ${new Date(o._creationTime).toLocaleDateString("pl-PL")}`);

          results.push({
            id: o._id,
            type: "szanse",
            title: clientName || "Szansa sprzedaży",
            subtitle: (o.email ? `📧 ${o.email}` : "") + (addr ? ` • ${addr}` : ""),
            customText: o.customText || undefined,
            details: o.phone ? `📞 ${o.phone}` : undefined,
            tags,
            status: o.archived ? {
              label: "Archiwum",
              variant: "secondary",
            } : {
              label: formatStatus(o.stage || "lead"),
              variant: "info",
            },
            url: `/admin/szansa/${o._id}`,
            score,
            snippet,
          });
        }
      }
    }

    // 4. Search Zadania (orderTasks & taskComments)
    if (searchTypes.includes("zadania")) {
      const tasks = await ctx.db.query("orderTasks").collect();
      const comments = await ctx.db.query("taskComments").collect();
      
      const commentsByTask = new Map<string, string[]>();
      for (const c of comments) {
        if (!commentsByTask.has(c.taskId)) {
          commentsByTask.set(c.taskId, []);
        }
        commentsByTask.get(c.taskId)!.push(c.body);
      }

      for (const t of tasks) {
        const taskComments = commentsByTask.get(t._id) || [];
        
        const fields = [
          { text: t.title ?? "", weight: 10 },
          ...taskComments.map(c => ({ text: c, weight: 6 }))
        ];

        const { score, snippet } = calculateScore(queryNorm, queryAlpha, queryTokens, digitsNorm, fields);

        if (score > 0) {
          let parentName = "Nieznane przypisanie";
          let taskUrl = "#";

          if (t.orderId) {
            const order = await ctx.db.get(t.orderId);
            if (order) {
              parentName = `Zlecenie: ${order.name || "Bez nazwy"}`;
              taskUrl = `/admin/klient/${order.clientId}/zlecenie/${order._id}`;
            }
          } else if (t.opportunityId) {
            const opp = await ctx.db.get(t.opportunityId);
            if (opp) {
              parentName = `Szansa: ${[opp.firstName, opp.lastName].filter(Boolean).join(" ")}`;
              taskUrl = `/admin/szansa/${opp._id}`;
            }
          } else if (t.complaintId) {
            parentName = `Reklamacja`;
            taskUrl = `/admin/reklamacje`;
          }

          // Truncate snippet for details if it's too long
          let displaySnippet = snippet !== t.title ? snippet : undefined;
          if (displaySnippet && displaySnippet.length > 80) {
            displaySnippet = displaySnippet.substring(0, 80) + "...";
          }
          
          const tags: string[] = [];
          if (t.dueDate) tags.push(`Termin: ${new Date(t.dueDate).toLocaleDateString("pl-PL")}`);
          if (t._creationTime) tags.push(`Dodano: ${new Date(t._creationTime).toLocaleDateString("pl-PL")}`);

          results.push({
            id: t._id,
            type: "zadania",
            title: t.title || "Zadanie",
            subtitle: parentName,
            details: displaySnippet ? `Komentarz: ${displaySnippet}` : undefined,
            tags,
            status: t.status === "done" ? {
              label: "Gotowe",
              variant: "success",
            } : t.status === "in_progress" ? {
              label: "W trakcie",
              variant: "info",
            } : {
              label: "Do zrobienia",
              variant: "default",
            },
            url: taskUrl,
            score,
            snippet,
          });
        }
      }
    }

    // 5. Search Reklamacje (complaints)
    if (searchTypes.includes("reklamacje")) {
      const complaints = await ctx.db.query("complaints").collect();
      // Load all clients and orders for quick lookup if not loaded yet
      const clients = await ctx.db.query("clients").collect();
      const clientMap = new Map(clients.map(c => [c._id, c]));
      const orders = await ctx.db.query("orders").collect();
      const orderMap = new Map(orders.map(o => [o._id, o]));

      for (const c of complaints) {
        const client = clientMap.get(c.clientId);
        const order = c.orderId ? orderMap.get(c.orderId) : null;
        
        const clientName = client ? [client.firstName, client.lastName].filter(Boolean).join(" ") : "";
        const clientCompany = client?.companyName ?? "";

        const orderAlcoNumbers = (order?.serviceDeliveries ?? [])
          .map((d) => d.externalOrderNumber)
          .filter((n): n is string => Boolean(n));
        const orderAlcoIds = (order?.serviceDeliveries ?? [])
          .map((d) => d.externalOrderId)
          .filter((id): id is string => Boolean(id));

        const fields = [
          { text: c.description ?? "", weight: 10 },
          { text: c.clientDescription ?? "", weight: 8 },
          { text: clientName, weight: 6 },
          { text: clientCompany, weight: 6 },
          { text: order?.name ?? "", weight: 6 },
          ...orderAlcoNumbers.map((num) => ({ text: num, weight: 8 })),
          ...orderAlcoIds.map((id) => ({ text: id, weight: 8 })),
        ];

        const { score, snippet } = calculateScore(queryNorm, queryAlpha, queryTokens, digitsNorm, fields);

        if (score > 0) {
          const tags: string[] = [];
          if (c.startDate) tags.push(`Zgłoszenie: ${new Date(c.startDate).toLocaleDateString("pl-PL")}`);
          if (order) tags.push(`Zlecenie: ${order.name || "Brak nazwy"}`);

          let displaySnippet = snippet;
          if (displaySnippet && displaySnippet.length > 80) {
            displaySnippet = displaySnippet.substring(0, 80) + "...";
          }

          let variant: "danger" | "warning" | "success" | "secondary" | "default" = "danger";
          if (c.status === "zamknieta" || c.status === "zakonczona") variant = "secondary";
          else if (c.status === "rozwiazana") variant = "success";
          else if (c.status === "w_toku") variant = "warning";

          results.push({
            id: c._id,
            type: "reklamacje",
            title: "Reklamacja",
            subtitle: clientName || clientCompany || "Brak klienta",
            details: displaySnippet ? `Opis: ${displaySnippet}` : undefined,
            tags,
            status: {
              label: c.status.replace("_", " ").toUpperCase(),
              variant,
            },
            url: `/admin/reklamacje`,
            score,
            snippet,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxLimit);
  },
});
