import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requireRole } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

const leaveTypeValidator = v.union(
  v.literal("vacation"),
  v.literal("sick"),
  v.literal("unpaid"),
  v.literal("other")
);

const leaveStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled")
);

const overtimeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected")
);

/**
 * Pobiera dane HR zalogowanego użytkownika (własne urlopy i nadgodziny).
 */
export const getMyHrData = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const leaves = await ctx.db
      .query("hrLeaves")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    const overtime = await ctx.db
      .query("hrOvertime")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    return {
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
      leaves,
      overtime,
    };
  },
});

/**
 * Pobiera wszystkie wpisy HR wszystkich pracowników (tylko dla Admina).
 */
export const getAllHrData = query({
  args: {
    userId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    month: v.optional(v.string()), // Format YYYY-MM
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const users = await ctx.db.query("users").collect();
    const userMap = new Map<Id<"users">, Doc<"users">>();
    for (const u of users) {
      userMap.set(u._id, u);
    }

    let rawLeaves: Doc<"hrLeaves">[];
    if (args.userId) {
      const selectedUserId = args.userId;
      rawLeaves = await ctx.db
        .query("hrLeaves")
        .withIndex("by_user", (q) => q.eq("userId", selectedUserId))
        .order("desc")
        .take(200);
    } else {
      rawLeaves = await ctx.db.query("hrLeaves").order("desc").take(200);
    }

    let rawOvertime: Doc<"hrOvertime">[];
    if (args.userId) {
      const selectedUserId = args.userId;
      rawOvertime = await ctx.db
        .query("hrOvertime")
        .withIndex("by_user", (q) => q.eq("userId", selectedUserId))
        .order("desc")
        .take(200);
    } else {
      rawOvertime = await ctx.db.query("hrOvertime").order("desc").take(200);
    }

    // Filtrowanie po statusie jeśli podano
    let leaves = rawLeaves;
    if (args.status && args.status !== "all") {
      leaves = leaves.filter((l) => l.status === args.status);
    }

    let overtime = rawOvertime;
    if (args.status && args.status !== "all") {
      overtime = overtime.filter((o) => o.status === args.status);
    }

    // Filtrowanie po miesiącu jeśli podano YYYY-MM
    if (args.month) {
      const m = args.month;
      leaves = leaves.filter((l) => l.startDate.startsWith(m) || l.endDate.startsWith(m));
      overtime = overtime.filter((o) => o.date.startsWith(m));
    }

    const enrichLeave = (l: Doc<"hrLeaves">) => {
      const u = userMap.get(l.userId);
      const app = l.approvedBy ? userMap.get(l.approvedBy) : undefined;
      return {
        ...l,
        userName: u?.displayName || u?.email || "Nieznany pracownik",
        userEmail: u?.email,
        approvedByName: app?.displayName || app?.email,
      };
    };

    const enrichOvertime = (o: Doc<"hrOvertime">) => {
      const u = userMap.get(o.userId);
      const app = o.approvedBy ? userMap.get(o.approvedBy) : undefined;
      return {
        ...o,
        userName: u?.displayName || u?.email || "Nieznany pracownik",
        userEmail: u?.email,
        approvedByName: app?.displayName || app?.email,
      };
    };

    return {
      leaves: leaves.map(enrichLeave),
      overtime: overtime.map(enrichOvertime),
    };
  },
});

/**
 * Zwraca podsumowanie statystyk HR.
 */
export const getHrSummary = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);

    // Moje statystyki
    const myLeaves = await ctx.db
      .query("hrLeaves")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    const myOvertime = await ctx.db
      .query("hrOvertime")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    const myApprovedVacationDays = myLeaves
      .filter((l) => l.type === "vacation" && l.status === "approved")
      .reduce((sum, l) => sum + l.daysCount, 0);

    const myPendingLeavesCount = myLeaves.filter((l) => l.status === "pending").length;

    const myApprovedOvertimeHours = myOvertime
      .filter((o) => o.status === "approved")
      .reduce((sum, o) => sum + o.hours, 0);

    const myPendingOvertimeHours = myOvertime
      .filter((o) => o.status === "pending")
      .reduce((sum, o) => sum + o.hours, 0);

    // Admin stats (jeśli role == admin)
    let companySummary = null;
    if (me.role === "admin") {
      const allLeaves = await ctx.db.query("hrLeaves").collect();
      const allOvertime = await ctx.db.query("hrOvertime").collect();

      const pendingLeavesCount = allLeaves.filter((l) => l.status === "pending").length;
      const pendingOvertimeCount = allOvertime.filter((o) => o.status === "pending").length;
      const totalApprovedOvertimeHours = allOvertime
        .filter((o) => o.status === "approved")
        .reduce((sum, o) => sum + o.hours, 0);

      companySummary = {
        pendingLeavesCount,
        pendingOvertimeCount,
        totalApprovedOvertimeHours,
      };
    }

    return {
      mySummary: {
        approvedVacationDays: myApprovedVacationDays,
        pendingLeavesCount: myPendingLeavesCount,
        approvedOvertimeHours: myApprovedOvertimeHours,
        pendingOvertimeHours: myPendingOvertimeHours,
      },
      companySummary,
    };
  },
});

/**
 * Zwraca zestawienie wszystkich pracowników wraz ze statystykami urlopowymi i nadgodzin (tylko dla Admina).
 */
export const getEmployeesHrOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const users = await ctx.db.query("users").collect();
    const activeUsers = users.filter((u) => u.isActive !== false && u.showInPickers !== false);

    const todayStr = new Date().toISOString().split("T")[0];

    const allLeaves = await ctx.db.query("hrLeaves").collect();
    const allOvertime = await ctx.db.query("hrOvertime").collect();

    return activeUsers.map((user) => {
      const userLeaves = allLeaves.filter((l) => l.userId === user._id);
      const userOvertime = allOvertime.filter((o) => o.userId === user._id);

      const approvedVacationDays = userLeaves
        .filter((l) => l.type === "vacation" && l.status === "approved")
        .reduce((sum, l) => sum + l.daysCount, 0);

      const approvedOvertimeHours = userOvertime
        .filter((o) => o.status === "approved")
        .reduce((sum, o) => sum + o.hours, 0);

      const pendingLeavesCount = userLeaves.filter((l) => l.status === "pending").length;
      const pendingOvertimeCount = userOvertime.filter((o) => o.status === "pending").length;

      const activeLeave = userLeaves.find(
        (l) => l.status === "approved" && l.startDate <= todayStr && l.endDate >= todayStr
      );

      return {
        _id: user._id,
        displayName: user.displayName || user.email || "Bez nazwy",
        email: user.email,
        role: user.role,
        color: user.color,
        approvedVacationDays,
        approvedOvertimeHours,
        pendingLeavesCount,
        pendingOvertimeCount,
        onLeaveToday: !!activeLeave,
        leaveUntil: activeLeave ? activeLeave.endDate : null,
        leaveType: activeLeave ? activeLeave.type : null,
      };
    }).sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "pl"));
  },
});

/**
 * Pracownik składa nowy wniosek urlopowy.
 */
export const submitLeave = mutation({
  args: {
    type: leaveTypeValidator,
    startDate: v.string(),
    endDate: v.string(),
    daysCount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!args.startDate || !args.endDate) {
      throw new ConvexError("Wymagane jest podanie daty początkowej i końcowej.");
    }
    if (args.startDate > args.endDate) {
      throw new ConvexError("Data początkowa nie może być późniejsza niż końcowa.");
    }
    if (args.daysCount <= 0) {
      throw new ConvexError("Liczba dni urlopu musi być większa od zero.");
    }

    const leaveId = await ctx.db.insert("hrLeaves", {
      userId: user._id,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      daysCount: args.daysCount,
      status: "pending",
      reason: args.reason?.trim() || undefined,
      createdAt: Date.now(),
    });

    return leaveId;
  },
});

/**
 * Pracownik zgłasza godziny dodatkowe (nadgodziny).
 */
export const submitOvertime = mutation({
  args: {
    date: v.string(),
    hours: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!args.date) {
      throw new ConvexError("Wymagane jest podanie daty.");
    }
    if (args.hours <= 0) {
      throw new ConvexError("Liczba godzin musi być większa od zero.");
    }
    if (!args.description.trim()) {
      throw new ConvexError("Wymagane jest podanie opisu wykonanych prac.");
    }

    const overtimeId = await ctx.db.insert("hrOvertime", {
      userId: user._id,
      date: args.date,
      hours: args.hours,
      description: args.description.trim(),
      status: "pending",
      createdAt: Date.now(),
    });

    return overtimeId;
  },
});

/**
 * Admin akceptuje lub odrzuca wniosek urlopowy.
 */
export const updateLeaveStatus = mutation({
  args: {
    leaveId: v.id("hrLeaves"),
    status: leaveStatusValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) {
      throw new ConvexError("Wniosek urlopowy nie istnieje.");
    }

    await ctx.db.patch(args.leaveId, {
      status: args.status,
      approvedBy: admin._id,
      approvedAt: Date.now(),
    });
  },
});

/**
 * Admin akceptuje lub odrzuca wpis nadgodzin.
 */
export const updateOvertimeStatus = mutation({
  args: {
    overtimeId: v.id("hrOvertime"),
    status: overtimeStatusValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    const overtime = await ctx.db.get(args.overtimeId);
    if (!overtime) {
      throw new ConvexError("Wpis nadgodzin nie istnieje.");
    }

    await ctx.db.patch(args.overtimeId, {
      status: args.status,
      approvedBy: admin._id,
      approvedAt: Date.now(),
    });
  },
});

/**
 * Anulowanie własnego wniosku urlopowego (lub dowolnego przez admina).
 */
export const cancelLeave = mutation({
  args: {
    leaveId: v.id("hrLeaves"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) {
      throw new ConvexError("Wniosek urlopowy nie istnieje.");
    }

    if (leave.userId !== user._id && user.role !== "admin") {
      throw new ConvexError("Brak uprawnień do anulowania tego wniosku.");
    }

    await ctx.db.patch(args.leaveId, {
      status: "cancelled",
    });
  },
});

/**
 * Usunięcie nadgodzin (własnych oczekujących lub dowolnych przez admina).
 */
export const deleteOvertime = mutation({
  args: {
    overtimeId: v.id("hrOvertime"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const overtime = await ctx.db.get(args.overtimeId);
    if (!overtime) {
      throw new ConvexError("Wpis nadgodzin nie istnieje.");
    }

    if (overtime.userId !== user._id && user.role !== "admin") {
      throw new ConvexError("Brak uprawnień do usunięcia tego wpisu.");
    }

    await ctx.db.delete(args.overtimeId);
  },
});
