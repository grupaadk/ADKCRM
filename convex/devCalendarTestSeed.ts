import { mutation } from "./_generated/server";
import { DEFAULT_DOCUMENTS } from "./orders";
import { getCurrentUser } from "./lib/auth";

export const seedDevCalendarData = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Sprawdź czy dane już istnieją, by nie dublować
    const existingEvents = await ctx.db
      .query("calendarEvents")
      .filter((q) => q.eq(q.field("description"), "DEV_TEST_SEED"))
      .collect();

    if (existingEvents.length > 0) {
      return { status: "already_seeded", count: existingEvents.length };
    }

    const currentUser = await getCurrentUser(ctx);

    // 2. Użytkownicy testowi
    const userJanId = await ctx.db.insert("users", {
      email: "dev.test.jan@example.com",
      displayName: "[DEV-TEST] Jan Kowalski",
      role: "sales",
      isActive: true,
      color: "#3b82f6",
    });

    const effectiveCreatorId = currentUser?._id ?? userJanId;

    const userAnnaId = await ctx.db.insert("users", {
      email: "dev.test.anna@example.com",
      displayName: "[DEV-TEST] Anna Nowak",
      role: "montaz",
      isActive: true,
      color: "#10b981",
    });

    // 3. Ekipy montażowe
    const teamAlfaId = await ctx.db.insert("installationTeams", {
      name: "[DEV-TEST] Ekipa Alfa",
      color: "#6366f1",
      leaderName: "Jan Lider",
      isActive: true,
      createdAt: Date.now(),
    });

    const teamBetaId = await ctx.db.insert("installationTeams", {
      name: "[DEV-TEST] Ekipa Beta",
      color: "#f59e0b",
      leaderName: "Anna Lider",
      isActive: true,
      createdAt: Date.now(),
    });

    // 4. Dostawcy
    const supplierSzkloId = await ctx.db.insert("suppliers", {
      name: "[DEV-TEST] Dostawca Szkła",
      isActive: true,
      createdBy: "dev-seed",
    });

    const supplierProfileId = await ctx.db.insert("suppliers", {
      name: "[DEV-TEST] Dostawca Profili",
      isActive: true,
      createdBy: "dev-seed",
    });

    // 5. Typy wydarzeń
    const allEventTypes = await ctx.db.query("calendarEventTypes").collect();
    let montazTypeId = allEventTypes.find(
      (t) =>
        t.linkedOrderField === "projectEndDate" ||
        t.name.toLowerCase() === "montaż" ||
        t.name.toLowerCase() === "montaz"
    )?._id;

    if (!montazTypeId) {
      montazTypeId = await ctx.db.insert("calendarEventTypes", {
        name: "Montaż",
        color: "#14b8a6",
        isPrivate: false,
        linkedOrderField: "projectEndDate",
        createdAt: Date.now(),
      });
    }

    let serwisTypeId = allEventTypes.find(
      (t) =>
        t.linkedOrderField === "complaintServiceDate" ||
        t.name.toLowerCase() === "serwis"
    )?._id;

    if (!serwisTypeId) {
      serwisTypeId = await ctx.db.insert("calendarEventTypes", {
        name: "Serwis",
        color: "#f97316",
        isPrivate: false,
        linkedOrderField: "complaintServiceDate",
        createdAt: Date.now(),
      });
    }

    const typeSpotkanieId = await ctx.db.insert("calendarEventTypes", {
      name: "[DEV-TEST] Spotkanie z klientem",
      color: "#a855f7",
      isPrivate: false,
      createdAt: Date.now(),
    });

    const typeDostawaId = await ctx.db.insert("calendarEventTypes", {
      name: "[DEV-TEST] Dostawa Profili",
      color: "#06b6d4",
      isPrivate: false,
      linkedSupplierId: supplierProfileId,
      createdAt: Date.now(),
    });

    // 6. Klient i Zlecenie testowe
    const clientId = await ctx.db.insert("clients", {
      firstName: "[DEV-TEST] Piotr",
      lastName: "Wiśniewski",
      city: "Poznań",
      street: "Główna",
      buildingNumber: "10",
      source: "manual",
      createdBy: "dev-seed",
    });

    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: "[DEV-TEST] Zlecenie Okna 2026",
      status: "installation",
      installationTeamId: teamAlfaId,
      investmentCity: "Poznań",
      documents: DEFAULT_DOCUMENTS,
      source: "manual",
      createdBy: "dev-seed",
    });

    // 7. Wydarzenia kalendarza
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;

    // Wydarzenie 1: Montaż u Piotra (Montaż, Ekipa Alfa, Jan Kowalski, zlec. Poznań)
    const ev1 = await ctx.db.insert("calendarEvents", {
      eventTypeId: montazTypeId,
      title: "[DEV-TEST] Montaż u Piotra",
      description: "DEV_TEST_SEED",
      startDate: now + oneHour,
      endDate: now + 3 * oneHour,
      isAllDay: false,
      assignedUserIds: [userJanId],
      installationTeamId: teamAlfaId,
      clientId,
      orderId,
      createdBy: effectiveCreatorId,
      isPrivate: false,
      createdAt: now,
    });

    // Wydarzenie 2: Serwis reklamacyjny (Serwis, Ekipa Beta, Anna Nowak)
    const ev2 = await ctx.db.insert("calendarEvents", {
      eventTypeId: serwisTypeId,
      title: "[DEV-TEST] Serwis reklamacyjny",
      description: "DEV_TEST_SEED",
      startDate: now + 4 * oneHour,
      endDate: now + 6 * oneHour,
      isAllDay: false,
      assignedUserIds: [userAnnaId],
      installationTeamId: teamBetaId,
      createdBy: effectiveCreatorId,
      isPrivate: false,
      createdAt: now,
    });

    // Wydarzenie 3: Spotkanie handlowe (Spotkanie, Jan Kowalski, bez ekipy)
    const ev3 = await ctx.db.insert("calendarEvents", {
      eventTypeId: typeSpotkanieId,
      title: "[DEV-TEST] Spotkanie handlowe",
      description: "DEV_TEST_SEED",
      startDate: now + oneDay,
      endDate: now + oneDay + 2 * oneHour,
      isAllDay: false,
      assignedUserIds: [userJanId],
      createdBy: effectiveCreatorId,
      isPrivate: false,
      createdAt: now,
    });

    // Wydarzenie 4: Rozładunek profili (Dostawa, Dostawca Profili, bez ekipy)
    const ev4 = await ctx.db.insert("calendarEvents", {
      eventTypeId: typeDostawaId,
      title: "[DEV-TEST] Rozładunek profili",
      description: "DEV_TEST_SEED",
      startDate: now + oneDay + 4 * oneHour,
      endDate: now + oneDay + 5 * oneHour,
      isAllDay: false,
      assignedUserIds: [],
      createdBy: effectiveCreatorId,
      isPrivate: false,
      createdAt: now,
    });

    // Wydarzenie 5: Notatka prywatna zarządu (Prywatne, Jan Kowalski)
    const ev5 = await ctx.db.insert("calendarEvents", {
      eventTypeId: montazTypeId,
      title: "[DEV-TEST] Notatka prywatna zarządu",
      description: "DEV_TEST_SEED",
      startDate: now + 2 * oneDay,
      endDate: now + 2 * oneDay + oneHour,
      isAllDay: true,
      assignedUserIds: [userJanId],
      createdBy: effectiveCreatorId,
      isPrivate: true,
      createdAt: now,
    });

    // Wydarzenie 6: Zadanie bez przypisania (brak usera, bez ekipy)
    const ev6 = await ctx.db.insert("calendarEvents", {
      eventTypeId: typeSpotkanieId,
      title: "[DEV-TEST] Zadanie bez przypisania",
      description: "DEV_TEST_SEED",
      startDate: now + 2 * oneDay + 3 * oneHour,
      endDate: now + 2 * oneDay + 4 * oneHour,
      isAllDay: false,
      assignedUserIds: [],
      createdBy: effectiveCreatorId,
      isPrivate: false,
      createdAt: now,
    });

    return {
      status: "success",
      events: [ev1, ev2, ev3, ev4, ev5, ev6],
      users: { userJanId, userAnnaId },
      teams: { teamAlfaId, teamBetaId },
      suppliers: { supplierSzkloId, supplierProfileId },
      types: { montazTypeId, serwisTypeId, typeSpotkanieId, typeDostawaId },
    };
  },
});

export const cleanupDevCalendarData = mutation({
  args: {},
  handler: async (ctx) => {
    let deletedCount = 0;

    // Usuń zdarzenia z description: "DEV_TEST_SEED" lub tytułem [DEV-TEST]
    const events = await ctx.db.query("calendarEvents").collect();
    for (const e of events) {
      if (e.description === "DEV_TEST_SEED" || e.title.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(e._id);
        deletedCount++;
      }
    }

    // Usuń zlecenia testowe
    const orders = await ctx.db.query("orders").collect();
    for (const o of orders) {
      if (o.name?.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(o._id);
        deletedCount++;
      }
    }

    // Usuń klientów testowych
    const clients = await ctx.db.query("clients").collect();
    for (const c of clients) {
      if (c.firstName.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(c._id);
        deletedCount++;
      }
    }

    // Usuń typy wydarzeń testowe
    const types = await ctx.db.query("calendarEventTypes").collect();
    for (const t of types) {
      if (t.name.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(t._id);
        deletedCount++;
      }
    }

    // Usuń dostawców testowych
    const suppliers = await ctx.db.query("suppliers").collect();
    for (const s of suppliers) {
      if (s.name.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(s._id);
        deletedCount++;
      }
    }

    // Usuń ekipy testowe
    const teams = await ctx.db.query("installationTeams").collect();
    for (const tm of teams) {
      if (tm.name.startsWith("[DEV-TEST]")) {
        await ctx.db.delete(tm._id);
        deletedCount++;
      }
    }

    // Usuń użytkowników testowych
    const currentUser = await getCurrentUser(ctx);
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (u.displayName?.startsWith("[DEV-TEST]") && u._id !== currentUser?._id) {
        await ctx.db.delete(u._id);
        deletedCount++;
      }
    }

    return { status: "cleaned", deletedCount };
  },
});
