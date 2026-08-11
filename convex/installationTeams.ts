import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

    // Typy wydarzeń w kalendarzu podpięte pod tę ekipę
    const allEventTypes = await ctx.db.query("calendarEventTypes").collect();
    const teamEventTypeIds = new Set(
      allEventTypes
        .filter((t) => t.linkedInstallationTeamId === args.teamId)
        .map((t) => t._id)
    );

    // Pobierz wydarzenia w kalendarzu dla ekipy
    const allCalendarEvents = await ctx.db.query("calendarEvents").collect();
    const teamCalendarEvents = allCalendarEvents.filter(
      (ev) => ev.installationTeamId === args.teamId || teamEventTypeIds.has(ev.eventTypeId)
    );
    const calendarEventsByOrder = new Map<string, typeof allCalendarEvents>();
    for (const ev of allCalendarEvents) {
      if (ev.orderId) {
        const list = calendarEventsByOrder.get(ev.orderId) ?? [];
        list.push(ev);
        calendarEventsByOrder.set(ev.orderId, list);
      }
    }

    // Pomocnik do pobierania YYYY-MM z timestampu
    const getMonthFromTs = (ts: number) => {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    };

    // Zbierz wszystkie identyfikatory zleceń powiązanych z ekipą (bezpośrednio, przez wydatki lub kalendarz)
    const teamOrderIds = new Set<string>([
      ...teamOrders.map((o) => o._id as string),
      ...teamExpenses.map((e) => e.orderId).filter((id): id is NonNullable<typeof id> => Boolean(id)),
      ...teamCalendarEvents.map((ev) => ev.orderId).filter((id): id is NonNullable<typeof id> => Boolean(id)),
    ]);
    const allTeamOrders = orders.filter((o) => teamOrderIds.has(o._id as string));

    // Przychody ze zleceń ekipy grupowane po miesiącu montażu/faktury
    const earningsByMonth: Record<string, number> = {};
    let totalEarnings = 0;
    for (const o of allTeamOrders) {
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
        const orderCalEvents = calendarEventsByOrder.get(o._id as string) ?? [];
        const firstCal = orderCalEvents.find((ev) => ev.startDate);
        if (firstCal?.startDate) {
          month = getMonthFromTs(firstCal.startDate);
        } else if (o.projectEndDate) {
          month = getMonthFromTs(o.projectEndDate);
        } else if (o.installationStartDate) {
          month = getMonthFromTs(o.installationStartDate);
        } else {
          const firstInv = orderInvoices.find((i) => i.issueDate);
          if (firstInv?.issueDate) {
            month = firstInv.issueDate.slice(0, 7);
          } else {
            month = getMonthFromTs(o._creationTime);
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

    // Liczba montaży i zestawienie elementów po miesiącu (zlecenia ekipy + kalendarz)
    const installationsByMonth: Record<string, number> = {};
    const itemsByMonth: Record<
      string,
      Array<{
        id: string;
        orderId?: string;
        clientId?: string;
        title: string;
        clientName: string;
        type: "order" | "calendar_event";
        dateStr?: string;
      }>
    > = {};

    const clientMap = new Map((await ctx.db.query("clients").collect()).map((c) => [c._id, c]));

    for (const o of allTeamOrders) {
      let month: string | null = null;
      let dateTs: number | undefined = undefined;
      const orderCalEvents = calendarEventsByOrder.get(o._id as string) ?? [];
      const firstCal = orderCalEvents.find((ev) => ev.startDate);
      if (firstCal?.startDate) {
        dateTs = firstCal.startDate;
        month = getMonthFromTs(firstCal.startDate);
      } else if (o.projectEndDate) {
        dateTs = o.projectEndDate;
        month = getMonthFromTs(o.projectEndDate);
      } else if (o.installationStartDate) {
        dateTs = o.installationStartDate;
        month = getMonthFromTs(o.installationStartDate);
      } else if (o.projectStartDate) {
        dateTs = o.projectStartDate;
        month = getMonthFromTs(o.projectStartDate);
      } else {
        const orderInvs = invoicesByOrder.get(o._id as string) ?? [];
        const firstInv = orderInvs.find((i) => i.issueDate);
        if (firstInv?.issueDate) {
          month = firstInv.issueDate.slice(0, 7);
        } else {
          const firstExp = teamExpenses.find((e) => e.orderId === o._id as string);
          if (firstExp?.issueDate) {
            month = firstExp.issueDate.slice(0, 7);
          } else {
            dateTs = o._creationTime;
            month = getMonthFromTs(o._creationTime);
          }
        }
      }
      if (month) {
        installationsByMonth[month] = (installationsByMonth[month] ?? 0) + 1;
        const client = clientMap.get(o.clientId);
        const clientName = client
          ? client.companyName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Klient"
          : "Klient";
        const dateStr = dateTs ? new Date(dateTs).toLocaleDateString("pl-PL") : undefined;

        itemsByMonth[month] = itemsByMonth[month] ?? [];
        itemsByMonth[month].push({
          id: o._id,
          orderId: o._id,
          clientId: o.clientId,
          title: o.name || o.customText || "Zlecenie bez nazwy",
          clientName,
          type: "order",
          dateStr,
        });
      }
    }

    // 2. Samodzielne wydarzenia kalendarzowe ekipy bez podpiętego orderId
    for (const ev of teamCalendarEvents) {
      if (!ev.orderId && ev.startDate) {
        const month = getMonthFromTs(ev.startDate);
        installationsByMonth[month] = (installationsByMonth[month] ?? 0) + 1;

        itemsByMonth[month] = itemsByMonth[month] ?? [];
        itemsByMonth[month].push({
          id: ev._id,
          title: ev.title,
          clientName: "Brak przypisanego klienta",
          type: "calendar_event",
          dateStr: new Date(ev.startDate).toLocaleDateString("pl-PL"),
        });
      }
    }

    // Zestawienie miesięczne — połącz koszty, przychody i liczbę montaży
    const allMonthsSet = new Set([
      ...Object.keys(expensesByMonth).filter((m) => m !== "unknown"),
      ...Object.keys(earningsByMonth),
      ...Object.keys(installationsByMonth),
    ]);
    const allMonthsSorted = Array.from(allMonthsSet).sort();

    const monthlyBreakdown = allMonthsSorted.map((month, idx) => {
      const curr = expensesByMonth[month] ?? { net: 0, gross: 0, count: 0 };
      const prevExpMonth = idx > 0 ? expensesByMonth[allMonthsSorted[idx - 1]] : null;
      const momChange = prevExpMonth && prevExpMonth.net > 0
        ? ((curr.net - prevExpMonth.net) / prevExpMonth.net) * 100
        : null;
      const earnings = earningsByMonth[month] ?? 0;
      const installationsCount = installationsByMonth[month] ?? 0;
      const items = itemsByMonth[month] ?? [];

      return {
        month,
        expenses: curr.net,
        expensesGross: curr.gross,
        count: curr.count,
        momChange,
        earnings,
        margin: earnings - curr.net,
        installationsCount,
        items,
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

      let timeStr: string | undefined;
      if (c.serviceDate) {
        const d = new Date(c.serviceDate);
        if (d.getHours() !== 0 || d.getMinutes() !== 0 || !!c.serviceDateEnd) {
          timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        }
      }

      return {
        id: c._id,
        clientId: c.clientId,
        orderId: c.orderId,
        complaintFolderId: c.complaintFolderId,
        type: "serwis" as const,
        title: "Serwis",
        description: c.description || c.clientDescription,
        date: c.serviceDate ?? c.startDate,
        serviceDateEnd: c.serviceDateEnd,
        timeStr,
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

export const getScheduleForUser = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !currentUser) return null;

    const userEmail = (currentUser?.email ?? identity?.email)?.toLowerCase();
    const userName = currentUser?.displayName ?? currentUser?.name ?? identity?.name;

    // Find target user from database
    const allUsers = await ctx.db.query("users").collect();
    let targetUser = args.userId ? allUsers.find((u) => u._id === args.userId) : currentUser;

    if (!targetUser && (userEmail || userName)) {
      targetUser = allUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === userEmail) ||
          (u.name && u.name.toLowerCase() === userName?.toLowerCase()) ||
          (u.displayName && u.displayName.toLowerCase() === userName?.toLowerCase())
      );
    }

    const targetUserEmail = targetUser?.email?.toLowerCase() ?? userEmail;
    const targetUserName = targetUser?.displayName ?? targetUser?.name ?? userName;

    // Matching user IDs (all user records with same email, name or _id)
    const matchingUserIds = new Set<string>();
    if (targetUser) matchingUserIds.add(targetUser._id);
    if (currentUser && !args.userId) matchingUserIds.add(currentUser._id);

    allUsers.forEach((u) => {
      if (
        (targetUserEmail && u.email?.toLowerCase() === targetUserEmail) ||
        (targetUserName && (u.displayName?.toLowerCase() === targetUserName.toLowerCase() || u.name?.toLowerCase() === targetUserName.toLowerCase()))
      ) {
        matchingUserIds.add(u._id);
      }
    });


    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find(
      (t) =>
        t.isActive &&
        ((targetUserName && t.leaderName?.toLowerCase() === targetUserName.toLowerCase()) ||
          (targetUserEmail && t.members?.some((m) => m.toLowerCase() === targetUserEmail)))
    );

    const orders = await ctx.db.query("orders").collect();
    const complaints = await ctx.db.query("complaints").collect();
    const calendarEvents = await ctx.db.query("calendarEvents").collect();
    const clients = await ctx.db.query("clients").collect();
    const clientMap = new Map(clients.map((c) => [c._id, c]));

    // Filter orders for target user or target user's team ONLY IF explicit installation dates exist
    const relevantOrders = orders.filter((o) => {
      const hasExplicitDates = !!(
        o.installationDates &&
        o.installationDates.length > 0 &&
        o.installationDates.some((d) => !!d.date)
      );
      if (!hasExplicitDates) return false;

      const assignedToUser =
        (o.assignedUserId && matchingUserIds.has(o.assignedUserId)) ||
        o.assignedUserIds?.some((id) => matchingUserIds.has(id)) ||
        (targetUserEmail && o.createdBy?.toLowerCase() === targetUserEmail);
      const assignedToTeam = team && o.installationTeamId === team._id;
      return assignedToUser || assignedToTeam;
    });

    // Filter complaints for target user or target user's team that HAVE an explicit service date
    const relevantComplaints = complaints.filter((c) => {
      const hasDate = !!c.serviceDate;
      if (!hasDate) return false;

      const assignedToUser =
        (targetUserEmail && c.assignedTo?.toLowerCase() === targetUserEmail) ||
        (targetUserEmail && c.createdBy?.toLowerCase() === targetUserEmail);
      const assignedToTeam = team && c.installationTeamId === team._id;
      return assignedToUser || assignedToTeam;
    });

    // Filter personal calendar events for target user
    const relevantEvents = calendarEvents.filter((ev) => {
      const isCreatedByTarget = matchingUserIds.has(ev.createdBy);
      const isAssignedToTarget = ev.assignedUserIds?.some((id) => matchingUserIds.has(id));
      const isTeamEvent = team && ev.installationTeamId === team._id;

      return isCreatedByTarget || isAssignedToTarget || isTeamEvent;
    });

    const formattedOrders: typeof items = [];

    relevantOrders.forEach((o) => {
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

      const timeStr = o.installationStartDate
        ? `${Math.floor(o.installationStartDate / 60).toString().padStart(2, "0")}:${(o.installationStartDate % 60).toString().padStart(2, "0")}`
        : undefined;

      const baseItem = {
        id: o._id,
        type: "montaz" as const,
        title: o.name ?? "Montaż stolarki",
        customText: o.customText,
        services: o.services ?? [],
        startDate: o.projectStartDate,
        endDate: o.projectEndDate,
        timeStr,
        status: o.status,
        clientName,
        phone: client?.phone,
        email: client?.email,
        address: fullAddress || "Brak adresu",
        comment: o.comment,
      };

      // Only iterate explicit installation dates added by user
      if (o.installationDates && o.installationDates.length > 0) {
        o.installationDates.forEach((instDate, idx) => {
          if (instDate.date) {
            formattedOrders.push({
              ...baseItem,
              id: `${o._id}_inst_${idx}`,
              date: instDate.date,
            });
          }
        });
      }
    });



    const formattedComplaints = relevantComplaints.map((c) => {
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

      let timeStr: string | undefined;
      if (c.serviceDate) {
        const d = new Date(c.serviceDate);
        if (d.getHours() !== 0 || d.getMinutes() !== 0 || !!c.serviceDateEnd) {
          timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        }
      }

      return {
        id: c._id,
        clientId: c.clientId,
        orderId: c.orderId,
        complaintFolderId: c.complaintFolderId,
        type: "serwis" as const,
        title: "Serwis",
        description: c.description || c.clientDescription,
        date: c.serviceDate ?? c.startDate,
        serviceDateEnd: c.serviceDateEnd,
        timeStr,
        status: c.status,
        clientName,
        phone: client?.phone,
        email: client?.email,
        address: fullAddress || "Brak adresu",
        todos: c.todos ?? [],
      };
    });

    const formattedCustomEvents = relevantEvents.map((ev) => {
      const d = new Date(ev.startDate);
      const timeStr = ev.isAllDay
        ? "Cały dzień"
        : `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

      return {
        id: ev._id,
        type: "wlasne" as const,
        title: ev.title,
        description: ev.description,
        date: ev.startDate,
        timeStr,
        status: "zaplanowane",
        clientName: "Wydarzenie własne",
        address: "",
      };
    });

    const items = [...formattedOrders, ...formattedComplaints, ...formattedCustomEvents].sort((a, b) => a.date - b.date);

    return {
      teamName: team?.name ?? targetUser?.displayName ?? targetUserName ?? userName ?? "Moje Wydarzenia",
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

export const updateEventDateByPin = mutation({
  args: {
    pin: v.string(),
    eventId: v.union(v.id("orders"), v.id("complaints")),
    eventType: v.union(v.literal("montaz"), v.literal("serwis")),
    newDate: v.number(),
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy kod PIN ekipy.");
    }

    if (args.eventType === "montaz") {
      const orderId = args.eventId as Id<"orders">;
      const order = await ctx.db.get(orderId);
      if (!order) throw new Error("Zlecenie nie istnieje.");
      if (order.installationTeamId !== team._id) {
        throw new Error("Brak uprawnień. Zlecenie nie jest przypisane do tej ekipy.");
      }

      // If we only have projectEndDate mapped as date, we should update both
      await ctx.db.patch(orderId, {
        projectStartDate: args.newDate,
        projectEndDate: args.newDate,
      });
    } else {
      const complaintId = args.eventId as Id<"complaints">;
      const complaint = await ctx.db.get(complaintId);
      if (!complaint) throw new Error("Reklamacja/Serwis nie istnieje.");
      if (complaint.installationTeamId !== team._id) {
        throw new Error("Brak uprawnień. Serwis nie jest przypisany do tej ekipy.");
      }

      await ctx.db.patch(complaintId, {
        startDate: args.newDate,
        serviceDate: args.newDate,
        serviceDateEnd: undefined, // Clear end date as it's a single day now
      });
    }
  },
});

export const listComplaintPhotosByPin = mutation({
  args: {
    pin: v.string(),
    complaintId: v.id("complaints"),
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
      throw new Error("Reklamacja nie istnieje.");
    }
    if (complaint.installationTeamId !== team._id) {
      throw new Error("Brak uprawnień. Reklamacja nie należy do tej ekipy.");
    }

    return {
      complaintFolderId: complaint.complaintFolderId,
      clientId: complaint.clientId,
      orderId: complaint.orderId,
    };
  },
});

