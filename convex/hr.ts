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
 * Pobiera dane HR zalogowanego użytkownika (własne urlopy i nadgodziny oraz limit).
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

    const currentYear = new Date().getFullYear();
    const allowanceDoc = await ctx.db
      .query("hrLeaveAllowances")
      .withIndex("by_user_year", (q) => q.eq("userId", user._id).eq("year", currentYear))
      .first();

    const vacationAllowance = allowanceDoc?.daysCount ?? user.vacationDaysAllowance ?? 26;

    const approvedVacationDays = leaves
      .filter((l) => l.type === "vacation" && l.status === "approved")
      .reduce((sum, l) => sum + l.daysCount, 0);

    const pendingVacationDays = leaves
      .filter((l) => l.type === "vacation" && l.status === "pending")
      .reduce((sum, l) => sum + l.daysCount, 0);

    const remainingVacationDays = vacationAllowance - approvedVacationDays;

    return {
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        vacationDaysAllowance: vacationAllowance,
      },
      vacationAllowance,
      approvedVacationDays,
      pendingVacationDays,
      remainingVacationDays,
      isOverLimit: (approvedVacationDays + pendingVacationDays) > vacationAllowance,
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

    const allAllowances = await ctx.db.query("hrLeaveAllowances").collect();
    const currentYear = new Date().getFullYear();
    const allowanceMap = new Map<Id<"users">, number>();
    for (const a of allAllowances) {
      if (a.year === currentYear) {
        allowanceMap.set(a.userId, a.daysCount);
      }
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

      const userVacationAllowance = u ? (allowanceMap.get(u._id) ?? u.vacationDaysAllowance ?? 26) : 26;
      const userApprovedVacationDays = rawLeaves
        .filter((rl) => rl.userId === l.userId && rl.type === "vacation" && rl.status === "approved")
        .reduce((sum, rl) => sum + rl.daysCount, 0);

      const isOverLimit = (userApprovedVacationDays + (l.status === "pending" ? l.daysCount : 0)) > userVacationAllowance;

      return {
        ...l,
        userName: u?.displayName || u?.email || "Nieznany pracownik",
        userEmail: u?.email,
        approvedByName: app?.displayName || app?.email,
        userVacationAllowance,
        userApprovedVacationDays,
        userRemainingVacationDays: userVacationAllowance - userApprovedVacationDays,
        isOverLimit,
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

    const currentYear = new Date().getFullYear();
    const allowanceDoc = await ctx.db
      .query("hrLeaveAllowances")
      .withIndex("by_user_year", (q) => q.eq("userId", me._id).eq("year", currentYear))
      .first();

    const vacationAllowance = allowanceDoc?.daysCount ?? me.vacationDaysAllowance ?? 26;

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
        vacationAllowance,
        approvedVacationDays: myApprovedVacationDays,
        remainingVacationDays: vacationAllowance - myApprovedVacationDays,
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
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const currentYear = args.year ?? new Date().getFullYear();
    const users = await ctx.db.query("users").collect();
    const activeUsers = users.filter((u) => u.isActive !== false && u.showInPickers !== false);

    const todayStr = new Date().toISOString().split("T")[0];

    const allLeaves = await ctx.db.query("hrLeaves").collect();
    const allOvertime = await ctx.db.query("hrOvertime").collect();
    const allAllowances = await ctx.db.query("hrLeaveAllowances").collect();

    const allowanceMap = new Map<Id<"users">, number>();
    for (const a of allAllowances) {
      if (a.year === currentYear) {
        allowanceMap.set(a.userId, a.daysCount);
      }
    }

    return activeUsers
      .map((user) => {
        const userLeaves = allLeaves.filter((l) => l.userId === user._id);
        const userOvertime = allOvertime.filter((o) => o.userId === user._id);

        const vacationAllowance = allowanceMap.get(user._id) ?? user.vacationDaysAllowance ?? 26;

        const approvedVacationDays = userLeaves
          .filter((l) => l.type === "vacation" && l.status === "approved")
          .reduce((sum, l) => sum + l.daysCount, 0);

        const pendingVacationDays = userLeaves
          .filter((l) => l.type === "vacation" && l.status === "pending")
          .reduce((sum, l) => sum + l.daysCount, 0);

        const remainingVacationDays = vacationAllowance - approvedVacationDays;
        const isOverLimit = approvedVacationDays + pendingVacationDays > vacationAllowance;

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
          vacationAllowance,
          approvedVacationDays,
          pendingVacationDays,
          remainingVacationDays,
          isOverLimit,
          approvedOvertimeHours,
          pendingLeavesCount,
          pendingOvertimeCount,
          onLeaveToday: !!activeLeave,
          leaveUntil: activeLeave ? activeLeave.endDate : null,
          leaveType: activeLeave ? activeLeave.type : null,
        };
      })
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "pl"));
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

/**
 * Trwałe usunięcie wniosku urlopowego (tylko admin).
 */
export const deleteLeave = mutation({
  args: {
    leaveId: v.id("hrLeaves"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) {
      throw new ConvexError("Wniosek urlopowy nie istnieje.");
    }

    await ctx.db.delete(args.leaveId);
  },
});

/**
 * Ustawia limit dni urlopu wypoczynkowego dla pracownika (tylko Admin).
 */
export const setEmployeeVacationAllowance = mutation({
  args: {
    userId: v.id("users"),
    year: v.optional(v.number()),
    daysCount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    if (args.daysCount < 0) {
      throw new ConvexError("Limit dni urlopu nie może być ujemny.");
    }

    const targetYear = args.year ?? new Date().getFullYear();

    const existing = await ctx.db
      .query("hrLeaveAllowances")
      .withIndex("by_user_year", (q) => q.eq("userId", args.userId).eq("year", targetYear))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        daysCount: args.daysCount,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("hrLeaveAllowances", {
        userId: args.userId,
        year: targetYear,
        daysCount: args.daysCount,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.userId, {
      vacationDaysAllowance: args.daysCount,
    });

    return { success: true, year: targetYear, daysCount: args.daysCount };
  },
});

/**
 * Parsuje datę wpisaną w komórce arkusza (np. "02.01", "2.1", "14.08", "2026-08-14")
 * do ustandaryzowanego formatu YYYY-MM-DD oraz DD.MM.
 */
function parseLeaveCellDate(input: string, year: number): { dateStr: string; displayDate: string } {
  const trimmed = input.trim();

  // Format YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      throw new ConvexError("Nieprawidłowa data. Podaj poprawny dzień i miesiąc (np. 14.08).");
    }
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return {
      dateStr: `${year}-${mm}-${dd}`,
      displayDate: `${dd}.${mm}`,
    };
  }

  // Format DD.MM lub DD,MM lub DD/MM lub DD-MM (opcjonalnie z rokiem na końcu)
  const dmMatch = /^(\d{1,2})[.,/-](\d{1,2})(?:[.,/-]\d{2,4})?$/.exec(trimmed);
  if (dmMatch) {
    const d = Number(dmMatch[1]);
    const m = Number(dmMatch[2]);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      throw new ConvexError("Nieprawidłowa data. Podaj dzień (1-31) i miesiąc (1-12), np. 02.01.");
    }
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return {
      dateStr: `${year}-${mm}-${dd}`,
      displayDate: `${dd}.${mm}`,
    };
  }

  throw new ConvexError("Wpisz datę w formacie DD.MM (np. 02.01 lub 14.08).");
}

/**
 * Wyciąga liczbę godzin (w tym ujemną i z przecinkiem, np. "- 2,5 h", "-1,5 (06.11)")
 * oraz opcjonalną datę z tekstu komórki GODZINY.
 */
function parseOvertimeCellText(rawText: string, year: number): { hours: number; dateStr: string } {
  const trimmed = rawText.trim();
  // Szukamy liczby na początku wpisu, np. "- 2,5", "-5", "+1.5", "2,5"
  const hoursMatch = /^([+-]?\s*\d+(?:[.,]\d+)?)/.exec(trimmed);
  let hours = 0;
  if (hoursMatch) {
    const normalized = hoursMatch[1].replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) {
      hours = parsed;
    }
  }

  // Szukamy daty w nawiasie lub w dalszej części tekstu, np. "(17.08)" lub "( 8.09)"
  let dateStr = `${year}-01-01`;
  const dateInParens = /\(\s*(\d{1,2})\.(\d{1,2})\s*\)/.exec(trimmed);
  if (dateInParens) {
    const d = Number(dateInParens[1]);
    const m = Number(dateInParens[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      dateStr = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return { hours, dateStr };
}

function formatDateToDdMm(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}`;
  }
  return dateStr;
}

/**
 * Pobiera komplet danych do widoku arkuszowego URLOPY {ROK} oraz GODZINY.
 */
export const getSpreadsheetData = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const users = await ctx.db.query("users").take(200);
    const activeUsers = users.filter((u) => u.isActive !== false && u.showInPickers !== false);

    const allowances = await ctx.db.query("hrLeaveAllowances").take(500);
    const allowanceByUser = new Map<Id<"users">, Doc<"hrLeaveAllowances">>();
    for (const a of allowances) {
      if (a.year === args.year) {
        allowanceByUser.set(a.userId, a);
      }
    }

    const allLeaves = await ctx.db.query("hrLeaves").take(2000);
    const allOvertime = await ctx.db.query("hrOvertime").take(2000);

    const yearPrefix = `${args.year}-`;

    const employees = activeUsers.map((user, idx) => {
      const allowanceDoc = allowanceByUser.get(user._id);
      const vacationAllowance = allowanceDoc?.daysCount ?? user.vacationDaysAllowance ?? 26;
      const showInLeaves = allowanceDoc?.showInLeaves ?? true;
      const showInOvertime = allowanceDoc?.showInOvertime ?? true;
      const sortOrder = allowanceDoc?.sortOrder ?? idx;

      // Urlopy pracownika w danym roku (pomijamy odrzucone/anulowane z dawnego systemu)
      const userLeaves = allLeaves.filter(
        (l) =>
          l.userId === user._id &&
          l.status !== "rejected" &&
          l.status !== "cancelled" &&
          (l.year === args.year || (l.year === undefined && l.startDate.startsWith(yearPrefix)))
      );

      const leaveCells: Record<
        number,
        { _id: Id<"hrLeaves">; dateStr: string; displayDate: string }
      > = {};

      const unassignedLeaves: Doc<"hrLeaves">[] = [];
      for (const l of userLeaves) {
        if (typeof l.rowIndex === "number" && l.rowIndex >= 0) {
          leaveCells[l.rowIndex] = {
            _id: l._id,
            dateStr: l.startDate,
            displayDate: formatDateToDdMm(l.startDate),
          };
        } else {
          unassignedLeaves.push(l);
        }
      }

      // Przypisz ewentualne starsze wpisy bez rowIndex do pierwszych wolnych wierszy
      unassignedLeaves.sort((a, b) => a.startDate.localeCompare(b.startDate));
      let nextLeaveRow = 0;
      for (const l of unassignedLeaves) {
        while (leaveCells[nextLeaveRow] !== undefined) {
          nextLeaveRow++;
        }
        leaveCells[nextLeaveRow] = {
          _id: l._id,
          dateStr: l.startDate,
          displayDate: formatDateToDdMm(l.startDate),
        };
        nextLeaveRow++;
      }

      // Godziny pracownika w danym roku
      const userOvertime = allOvertime.filter(
        (o) =>
          o.userId === user._id &&
          o.status !== "rejected" &&
          (o.year === args.year || (o.year === undefined && o.date.startsWith(yearPrefix)))
      );

      const overtimeCells: Record<
        number,
        { _id: Id<"hrOvertime">; rawText: string; hours: number; dateStr: string }
      > = {};

      const unassignedOvertime: Doc<"hrOvertime">[] = [];
      for (const o of userOvertime) {
        if (typeof o.rowIndex === "number" && o.rowIndex >= 0) {
          const fallbackText = `${o.hours > 0 ? `+${o.hours}` : o.hours}h (${formatDateToDdMm(o.date)})`;
          overtimeCells[o.rowIndex] = {
            _id: o._id,
            rawText: o.rawText ?? fallbackText,
            hours: o.hours,
            dateStr: o.date,
          };
        } else {
          unassignedOvertime.push(o);
        }
      }

      unassignedOvertime.sort((a, b) => a.date.localeCompare(b.date));
      let nextOtRow = 0;
      for (const o of unassignedOvertime) {
        while (overtimeCells[nextOtRow] !== undefined) {
          nextOtRow++;
        }
        const fallbackText = `${o.hours > 0 ? `+${o.hours}` : o.hours}h (${formatDateToDdMm(o.date)})`;
        overtimeCells[nextOtRow] = {
          _id: o._id,
          rawText: o.rawText ?? fallbackText,
          hours: o.hours,
          dateStr: o.date,
        };
        nextOtRow++;
      }

      const usedLeaveDays = Object.keys(leaveCells).length;
      const totalOvertimeHours = Object.values(overtimeCells).reduce(
        (sum, cell) => sum + cell.hours,
        0
      );

      const shortName =
        user.firstName?.trim() ||
        user.displayName?.trim().split(/\s+/)[0] ||
        user.email?.split("@")[0] ||
        "Pracownik";

      return {
        _id: user._id,
        shortName,
        displayName: user.displayName || user.email || "Pracownik",
        email: user.email,
        color: user.color,
        role: user.role,
        vacationAllowance,
        showInLeaves,
        showInOvertime,
        sortOrder,
        leaveCells,
        overtimeCells,
        usedLeaveDays,
        remainingLeaveDays: vacationAllowance - usedLeaveDays,
        totalOvertimeHours,
      };
    });

    employees.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.displayName.localeCompare(b.displayName, "pl");
    });

    return {
      year: args.year,
      employees,
    };
  },
});

/**
 * Zapisuje lub usuwa wpis w pojedynczej komórce tabeli URLOPY.
 */
export const setLeaveCell = mutation({
  args: {
    userId: v.id("users"),
    year: v.number(),
    rowIndex: v.number(),
    value: v.string(),
    existingId: v.optional(v.id("hrLeaves")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    if (args.rowIndex < 0 || args.rowIndex > 365) {
      throw new ConvexError("Nieprawidłowy indeks wiersza.");
    }

    let existingCell: Doc<"hrLeaves"> | null = null;
    if (args.existingId) {
      existingCell = await ctx.db.get(args.existingId);
    }
    if (!existingCell) {
      const existingForUserYear = await ctx.db
        .query("hrLeaves")
        .withIndex("by_user_year", (q) => q.eq("userId", args.userId).eq("year", args.year))
        .take(400);
      existingCell = existingForUserYear.find((l) => l.rowIndex === args.rowIndex) ?? null;
    }

    const trimmed = args.value.trim();

    if (!trimmed) {
      if (existingCell) {
        await ctx.db.delete(existingCell._id);
      }
      return { deleted: true };
    }

    const { dateStr, displayDate } = parseLeaveCellDate(trimmed, args.year);
    const now = Date.now();

    if (existingCell) {
      await ctx.db.patch(existingCell._id, {
        startDate: dateStr,
        endDate: dateStr,
        daysCount: 1,
        type: "vacation",
        status: "approved",
        year: args.year,
        rowIndex: args.rowIndex,
        approvedBy: currentUser._id,
        approvedAt: now,
      });
      return { deleted: false, leaveId: existingCell._id, dateStr, displayDate };
    }

    const leaveId = await ctx.db.insert("hrLeaves", {
      userId: args.userId,
      type: "vacation",
      startDate: dateStr,
      endDate: dateStr,
      daysCount: 1,
      status: "approved",
      year: args.year,
      rowIndex: args.rowIndex,
      approvedBy: currentUser._id,
      approvedAt: now,
      createdAt: now,
    });

    return { deleted: false, leaveId, dateStr, displayDate };
  },
});

/**
 * Zapisuje lub usuwa wpis w pojedynczej komórce tabeli GODZINY.
 */
export const setOvertimeCell = mutation({
  args: {
    userId: v.id("users"),
    year: v.number(),
    rowIndex: v.number(),
    rawText: v.string(),
    existingId: v.optional(v.id("hrOvertime")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    if (args.rowIndex < 0 || args.rowIndex > 365) {
      throw new ConvexError("Nieprawidłowy indeks wiersza.");
    }

    let existingCell: Doc<"hrOvertime"> | null = null;
    if (args.existingId) {
      existingCell = await ctx.db.get(args.existingId);
    }
    if (!existingCell) {
      const existingForUserYear = await ctx.db
        .query("hrOvertime")
        .withIndex("by_user_year", (q) => q.eq("userId", args.userId).eq("year", args.year))
        .take(400);
      existingCell = existingForUserYear.find((o) => o.rowIndex === args.rowIndex) ?? null;
    }

    const trimmed = args.rawText.trim();

    if (!trimmed) {
      if (existingCell) {
        await ctx.db.delete(existingCell._id);
      }
      return { deleted: true };
    }

    const { hours, dateStr } = parseOvertimeCellText(trimmed, args.year);
    const now = Date.now();

    if (existingCell) {
      await ctx.db.patch(existingCell._id, {
        date: dateStr,
        hours,
        description: trimmed,
        rawText: trimmed,
        year: args.year,
        rowIndex: args.rowIndex,
        status: "approved",
        approvedBy: currentUser._id,
        approvedAt: now,
      });
      return { deleted: false, overtimeId: existingCell._id, rawText: trimmed, hours };
    }

    const overtimeId = await ctx.db.insert("hrOvertime", {
      userId: args.userId,
      date: dateStr,
      hours,
      description: trimmed,
      rawText: trimmed,
      year: args.year,
      rowIndex: args.rowIndex,
      status: "approved",
      approvedBy: currentUser._id,
      approvedAt: now,
      createdAt: now,
    });

    return { deleted: false, overtimeId, rawText: trimmed, hours };
  },
});

/**
 * Aktualizuje konfigurację arkusza dla pracownika (limit dni urlopu, widoczność w tabelach, kolejność).
 */
export const updateEmployeeSheetConfig = mutation({
  args: {
    userId: v.id("users"),
    year: v.number(),
    daysCount: v.optional(v.number()),
    showInLeaves: v.optional(v.boolean()),
    showInOvertime: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    if (args.daysCount !== undefined && (args.daysCount < 0 || args.daysCount > 365)) {
      throw new ConvexError("Limit dni urlopu musi mieścić się w przedziale 0–365.");
    }

    const existing = await ctx.db
      .query("hrLeaveAllowances")
      .withIndex("by_user_year", (q) => q.eq("userId", args.userId).eq("year", args.year))
      .first();

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("Pracownik nie istnieje.");
    }

    const now = Date.now();
    const resolvedDays = args.daysCount ?? existing?.daysCount ?? user.vacationDaysAllowance ?? 26;

    if (existing) {
      const patch: Partial<Doc<"hrLeaveAllowances">> = {
        updatedAt: now,
      };
      if (args.daysCount !== undefined) patch.daysCount = args.daysCount;
      if (args.showInLeaves !== undefined) patch.showInLeaves = args.showInLeaves;
      if (args.showInOvertime !== undefined) patch.showInOvertime = args.showInOvertime;
      if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("hrLeaveAllowances", {
        userId: args.userId,
        year: args.year,
        daysCount: resolvedDays,
        showInLeaves: args.showInLeaves ?? true,
        showInOvertime: args.showInOvertime ?? true,
        sortOrder: args.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.daysCount !== undefined) {
      await ctx.db.patch(args.userId, {
        vacationDaysAllowance: args.daysCount,
      });
    }

    return { success: true };
  },
});


