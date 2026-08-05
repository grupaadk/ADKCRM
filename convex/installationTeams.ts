import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("installationTeams").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const teams = await ctx.db.query("installationTeams").collect();
    return teams.filter((t) => t.isActive);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    leaderName: v.optional(v.string()),
    phone: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    pin: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin?.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      throw new Error("PIN do aplikacji mobilnej musi składać się z dokładnie 4 cyfr.");
    }
    return await ctx.db.insert("installationTeams", {
      name: args.name,
      color: args.color ?? "#10b981",
      leaderName: args.leaderName,
      phone: args.phone,
      members: args.members,
      pin: cleanPin || undefined,
      isActive: args.isActive,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("installationTeams"),
    name: v.string(),
    color: v.optional(v.string()),
    leaderName: v.optional(v.string()),
    phone: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    pin: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin?.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      throw new Error("PIN do aplikacji mobilnej musi składać się z dokładnie 4 cyfr.");
    }
    await ctx.db.patch(args.id, {
      name: args.name,
      color: args.color,
      leaderName: args.leaderName,
      phone: args.phone,
      members: args.members,
      pin: cleanPin || undefined,
      isActive: args.isActive,
    });
  },
});

export const getById = query({
  args: { id: v.id("installationTeams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getDetailed = query({
  args: { id: v.optional(v.id("installationTeams")) },
  handler: async (ctx, args) => {
    if (!args.id) return null;
    return await ctx.db.get(args.id);
  },
});

export const listAllWithStats = query({
  args: {},
  handler: async (ctx) => {
    const teams = await ctx.db.query("installationTeams").collect();
    const orders = await ctx.db.query("orders").collect();
    const complaints = await ctx.db.query("complaints").collect();

    const now = Date.now();

    return teams.map((team) => {
      const teamOrders = orders.filter((o) => o.installationTeamId === team._id);
      const teamComplaints = complaints.filter((c) => c.installationTeamId === team._id);
      const openComplaints = teamComplaints.filter((c) => c.status !== "rozwiazana" && c.status !== "zamknieta");
      const upcomingInstallations = teamOrders.filter((o) => o.projectEndDate && o.projectEndDate >= now);

      return {
        ...team,
        ordersCount: teamOrders.length,
        complaintsCount: teamComplaints.length,
        openComplaintsCount: openComplaints.length,
        upcomingInstallationsCount: upcomingInstallations.length,
      };
    });
  },
});

export const getTeamOrders = query({
  args: { teamId: v.id("installationTeams") },
  handler: async (ctx, args) => {
    const orders = await ctx.db.query("orders").collect();
    const teamOrders = orders.filter((o) => o.installationTeamId === args.teamId);

    const clients = await ctx.db.query("clients").collect();
    const clientMap = new Map(clients.map((c) => [c._id, c]));

    return teamOrders.map((o) => {
      const client = clientMap.get(o.clientId);
      const clientName = client
        ? client.companyName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Klient"
        : "Klient";
      return {
        ...o,
        clientName,
        clientPhone: client?.phone,
        clientAddress: client ? [client.street, client.buildingNumber, client.city].filter(Boolean).join(" ") : undefined,
      };
    }).sort((a, b) => (b.projectEndDate ?? 0) - (a.projectEndDate ?? 0));
  },
});

export const getTeamComplaints = query({
  args: { teamId: v.id("installationTeams") },
  handler: async (ctx, args) => {
    const complaints = await ctx.db.query("complaints").collect();
    const teamComplaints = complaints.filter((c) => c.installationTeamId === args.teamId);

    const clients = await ctx.db.query("clients").collect();
    const clientMap = new Map(clients.map((c) => [c._id, c]));

    const orders = await ctx.db.query("orders").collect();
    const orderMap = new Map(orders.map((o) => [o._id, o]));

    return teamComplaints.map((c) => {
      const client = clientMap.get(c.clientId);
      const clientName = client
        ? client.companyName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Klient"
        : "Klient";
      const order = c.orderId ? orderMap.get(c.orderId) : null;

      return {
        ...c,
        clientName,
        orderName: order?.name ?? "Reklamacja",
        orderCustomText: order?.customText,
      };
    }).sort((a, b) => (b.serviceDate ?? 0) - (a.serviceDate ?? 0));
  },
});

export const remove = mutation({
  args: {
    id: v.id("installationTeams"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getTeamFinancials = query({
  args: {
    teamId: v.id("installationTeams"),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Wydatki przypisane do tej ekipy (kategoria Montaż)
    const expenses = await ctx.db
      .query("fakturowniaExpensesCache")
      .collect();
    const teamExpenses = expenses.filter(
      (e) => e.installationTeamId === args.teamId
    );

    // Kategorie wydatków
    const categories = await ctx.db.query("expenseCategories").collect();
    const catMap = new Map(categories.map((c) => [c._id, c.name]));

    // Zlecenia — potrzebne do przychodów i linków
    const orders = await ctx.db.query("orders").collect();
    const teamOrders = orders.filter((o) => o.installationTeamId === args.teamId);
    const orderMap = new Map(orders.map((o) => [o._id as string, o]));

    // Pobierz faktury dla zleceń ekipy
    const allInvoices = await ctx.db.query("fakturowniaInvoicesCache").collect();
    const invoicesByOrder = new Map<string, typeof allInvoices>();
    for (const inv of allInvoices) {
      if (inv.orderId) {
        const list = invoicesByOrder.get(inv.orderId) ?? [];
        list.push(inv);
        invoicesByOrder.set(inv.orderId, list);
      }
    }

    // Przychody ze zleceń ekipy grupowane po miesiącu montażu/faktury
    const earningsByMonth: Record<string, number> = {};
    let totalEarnings = 0;
    for (const o of teamOrders) {
      const serviceFinanceSum = (o.serviceFinances ?? []).reduce(
        (sum, f) => sum + (f.earningsAmount ?? 0),
        0
      );

      const orderInvoices = invoicesByOrder.get(o._id as string) ?? [];
      const regularInvsNet = orderInvoices
        .filter((inv) => inv.kind !== "estimate" && inv.kind !== "order")
        .reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);
      const estimateInvsNet = orderInvoices
        .filter((inv) => inv.kind === "estimate" || inv.kind === "order")
        .reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);

      const orderRevenue = serviceFinanceSum > 0
        ? serviceFinanceSum
        : (regularInvsNet > 0 ? regularInvsNet : estimateInvsNet);

      totalEarnings += orderRevenue;

      if (orderRevenue > 0) {
        let month: string | null = null;
        if (o.projectEndDate) {
          month = new Date(o.projectEndDate).toISOString().slice(0, 7);
        } else {
          const firstInv = orderInvoices.find((i) => i.issueDate);
          if (firstInv?.issueDate) {
            month = firstInv.issueDate.slice(0, 7);
          } else {
            month = new Date(o._creationTime).toISOString().slice(0, 7);
          }
        }
        if (month) {
          earningsByMonth[month] = (earningsByMonth[month] ?? 0) + orderRevenue;
        }
      }
    }

    // Suma kosztów
    const totalExpensesNet = teamExpenses.reduce(
      (s, e) => s + (e.netAmount ?? 0),
      0
    );
    const totalExpensesGross = teamExpenses.reduce(
      (s, e) => s + (e.grossAmount ?? 0),
      0
    );

    // Grupuj wydatki po miesiącu (YYYY-MM)
    const expensesByMonth: Record<string, { net: number; gross: number; count: number }> = {};
    for (const e of teamExpenses) {
      const month = e.issueDate ? e.issueDate.slice(0, 7) : "unknown";
      const prev = expensesByMonth[month] ?? { net: 0, gross: 0, count: 0 };
      expensesByMonth[month] = {
        net: prev.net + (e.netAmount ?? 0),
        gross: prev.gross + (e.grossAmount ?? 0),
        count: prev.count + 1,
      };
    }

    // Zestawienie miesięczne — połącz koszty i przychody
    const allMonthsSet = new Set([
      ...Object.keys(expensesByMonth).filter((m) => m !== "unknown"),
      ...Object.keys(earningsByMonth),
    ]);
    const allMonthsSorted = Array.from(allMonthsSet).sort();

    const monthlyBreakdown = allMonthsSorted.map((month, idx) => {
      const curr = expensesByMonth[month] ?? { net: 0, gross: 0, count: 0 };
      const prevExpMonth = idx > 0 ? expensesByMonth[allMonthsSorted[idx - 1]] : null;
      const momChange = prevExpMonth && prevExpMonth.net > 0
        ? ((curr.net - prevExpMonth.net) / prevExpMonth.net) * 100
        : null;
      const earnings = earningsByMonth[month] ?? 0;
      return {
        month,
        expenses: curr.net,
        expensesGross: curr.gross,
        count: curr.count,
        momChange,
        earnings,
        margin: earnings - curr.net,
      };
    });

    // Wydatki z nazwami kategorii i danymi zlecenia
    const expensesWithCategory = teamExpenses.map((e) => {
      const order = e.orderId ? orderMap.get(e.orderId) : undefined;
      return {
        _id: e._id,
        number: e.number,
        sellerName: e.sellerName,
        issueDate: e.issueDate,
        netAmount: e.netAmount,
        grossAmount: e.grossAmount,
        currency: e.currency,
        categoryName: e.categoryId ? catMap.get(e.categoryId) ?? "—" : "—",
        orderId: e.orderId,
        orderName: order?.name ?? order?.customText ?? null,
        clientId: order?.clientId ?? null,
      };
    });

    return {
      totalExpensesNet,
      totalExpensesGross,
      totalEarnings,
      expensesCount: teamExpenses.length,
      monthlyBreakdown,
      recentExpenses: expensesWithCategory
        .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""))
        .slice(0, 20),
    };
  },
});

export const verifyPin = query({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    if (!cleanPin || cleanPin.length !== 4) {
      return { success: false, error: "PIN musi składać się z 4 cyfr." };
    }
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      return { success: false, error: "Nieprawidłowy kod PIN ekipy lub ekipa jest nieaktywna." };
    }
    return {
      success: true,
      team: {
        _id: team._id,
        name: team.name,
        color: team.color ?? "#10b981",
        leaderName: team.leaderName,
        phone: team.phone,
        members: team.members,
      },
    };
  },
});

export const getScheduleByPin = query({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    if (!cleanPin || cleanPin.length !== 4) {
      return null;
    }
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      return null;
    }

    const orders = await ctx.db.query("orders").collect();
    const complaints = await ctx.db.query("complaints").collect();
    const clients = await ctx.db.query("clients").collect();
    const clientMap = new Map(clients.map((c) => [c._id, c]));

    const teamOrders = orders.filter((o) => o.installationTeamId === team._id);
    const teamComplaints = complaints.filter((c) => c.installationTeamId === team._id);

    const formattedOrders = teamOrders.map((o) => {
      const client = clientMap.get(o.clientId);
      const clientName = client
        ? client.companyName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Klient"
        : "Klient";

      const fullAddress = [
        o.investmentStreet || client?.street,
        o.investmentBuildingNumber || client?.buildingNumber,
        o.investmentApartmentNumber ? `m. ${o.investmentApartmentNumber}` : client?.apartmentNumber ? `m. ${client.apartmentNumber}` : undefined,
        o.investmentPostalCode || client?.postalCode,
        o.investmentCity || client?.city,
      ].filter(Boolean).join(" ");

      return {
        id: o._id,
        type: "montaz" as const,
        title: o.name ?? "Montaż stolarki",
        customText: o.customText,
        services: o.services ?? [],
        date: o.projectEndDate ?? o.statusChangedAt ?? Date.now(),
        startDate: o.projectStartDate,
        endDate: o.projectEndDate,
        timeStr: o.installationStartDate
          ? `${Math.floor(o.installationStartDate / 60).toString().padStart(2, "0")}:${(o.installationStartDate % 60).toString().padStart(2, "0")}`
          : undefined,
        status: o.status,
        clientName,
        phone: client?.phone,
        email: client?.email,
        address: fullAddress || "Brak adresu",
        comment: o.comment,
      };
    });

    const formattedComplaints = teamComplaints.map((c) => {
      const client = clientMap.get(c.clientId);
      const clientName = client
        ? client.companyName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Klient"
        : "Klient";

      const fullAddress = [
        client?.street,
        client?.buildingNumber,
        client?.apartmentNumber ? `m. ${client.apartmentNumber}` : undefined,
        client?.postalCode,
        client?.city,
      ].filter(Boolean).join(" ");

      return {
        id: c._id,
        type: "serwis" as const,
        title: "Serwis",
        description: c.description || c.clientDescription,
        date: c.serviceDate ?? c.startDate,
        serviceDateEnd: c.serviceDateEnd,
        status: c.status,
        clientName,
        phone: client?.phone,
        email: client?.email,
        address: fullAddress || "Brak adresu",
        todos: c.todos ?? [],
      };
    });

    const items = [...formattedOrders, ...formattedComplaints].sort((a, b) => a.date - b.date);

    return {
      team: {
        _id: team._id,
        name: team.name,
        color: team.color ?? "#10b981",
        leaderName: team.leaderName,
        phone: team.phone,
        members: team.members,
      },
      items,
    };
  },
});

export const updateOrderStatusByPin = mutation({
  args: {
    pin: v.string(),
    orderId: v.id("orders"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy kod PIN ekipy.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Zlecenie nie istnieje.");
    }
    if (order.installationTeamId !== team._id) {
      throw new Error("Brak uprawnień. Zlecenie nie jest przypisane do tej ekipy.");
    }

    await ctx.db.patch(args.orderId, {
      status: args.newStatus,
      statusChangedAt: Date.now(),
    });
  },
});

export const updateComplaintStatusByPin = mutation({
  args: {
    pin: v.string(),
    complaintId: v.id("complaints"),
    newStatus: v.union(
      v.literal("nowa"),
      v.literal("w_toku"),
      v.literal("rozwiazana"),
      v.literal("zamknieta"),
      v.literal("zakonczona")
    ),
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy kod PIN ekipy.");
    }

    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) {
      throw new Error("Zgłoszenie nie istnieje.");
    }
    if (complaint.installationTeamId !== team._id) {
      throw new Error("Brak uprawnień. Zgłoszenie nie jest przypisane do tej ekipy.");
    }

    await ctx.db.patch(args.complaintId, {
      status: args.newStatus,
    });
  },
});
