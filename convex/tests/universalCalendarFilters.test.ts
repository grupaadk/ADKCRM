import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("UniversalCalendar Filtering Logic (/admin/kalendarz)", () => {
  test("runs all 10 filter scenarios correctly on dev test dataset", async () => {
    const t = convexTest(schema, modules);

    // 1. Setup authenticated runner
    const runnerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "runner@test.pl",
        displayName: "Test Runner",
        role: "admin",
        isActive: true,
      });
    });
    const asUser = t.withIdentity({ subject: runnerUserId });

    // 2. Seed test data
    const seedResult = await asUser.mutation(api.devCalendarTestSeed.seedDevCalendarData, {});
    expect(seedResult.status).toBe("success");

    const { userJanId, userAnnaId } = seedResult.users!;
    const { teamAlfaId, teamBetaId } = seedResult.teams!;
    const { supplierProfileId } = seedResult.suppliers!;
    const { montazTypeId, serwisTypeId, typeSpotkanieId, typeDostawaId } = seedResult.types!;

    const now = Date.now();
    const startDate = now - 1000 * 60 * 60; // 1h ago
    const endDate = now + 1000 * 60 * 60 * 24 * 7; // +7 days

    // 3. Fetch events from backend
    const rawEvents = await asUser.query(api.calendarEvents.getEvents, {
      startDate,
      endDate,
    });

    const testEvents = rawEvents.filter((e) => e.description === "DEV_TEST_SEED");
    expect(testEvents.length).toBe(6);

    // Filter helper matching UniversalCalendar.tsx matchesFilters logic exactly
    interface FilterParams {
      eventTypeId: string;
      supplierId?: string;
      installationTeamId?: string;
      assignedUserIds?: string[];
      assignedUserId?: string;
      title?: string;
      orderName?: string;
      clientName?: string;
      customText?: string;
      city?: string;
    }

    interface FilterConfig {
      searchQuery?: string;
      activeUserFilters?: Set<string>;
      activeEventTypeFilters?: Set<string>;
      activeTeamFilters?: Set<string>;
      disabledTeamEventTypes?: Set<string>;
      activeSupplierFilters?: Set<string>;
      showPrivate?: boolean;
    }

    const allTeamIds = [teamAlfaId, teamBetaId];
    const allSupplierIds = [supplierProfileId];

    const evaluateEvent = (e: typeof testEvents[0], config: FilterConfig): boolean => {
      if (!config.showPrivate && e.isPrivate) return false;

      const p: FilterParams = {
        eventTypeId: e.eventTypeId,
        supplierId: e.eventType?.linkedSupplierId,
        installationTeamId: e.installationTeamId,
        assignedUserIds: e.assignedUserIds ?? [],
        title: e.title,
        customText: e.description,
      };

      // Search Query
      if (config.searchQuery) {
        const q = config.searchQuery.toLowerCase().trim();
        const titleMatch = (p.title ?? "").toLowerCase().includes(q);
        const orderMatch = (p.orderName ?? "").toLowerCase().includes(q);
        const clientMatch = (p.clientName ?? "").toLowerCase().includes(q);
        const customMatch = (p.customText ?? "").toLowerCase().includes(q);
        const cityMatch = (p.city ?? "").toLowerCase().includes(q);
        if (!titleMatch && !orderMatch && !clientMatch && !customMatch && !cityMatch) {
          return false;
        }
      }

      // User Filter
      if (config.activeUserFilters && config.activeUserFilters.size > 0) {
        const uids = p.assignedUserIds ?? [];
        const userMatch =
          uids.some((uid) => config.activeUserFilters!.has(uid)) ||
          (uids.length === 0 && config.activeUserFilters!.has("__none__"));
        if (!userMatch) return false;
      }

      // Event Type Filter
      if (config.activeEventTypeFilters) {
        if (!config.activeEventTypeFilters.has(p.eventTypeId)) return false;
      }

      // Team Filter
      if (config.activeTeamFilters && config.activeTeamFilters.size < allTeamIds.length) {
        if (p.installationTeamId && !config.activeTeamFilters.has(p.installationTeamId)) {
          return false;
        }
      }

      // Team Task Subfilter (disabledTeamEventTypes)
      if (config.disabledTeamEventTypes && p.installationTeamId) {
        if (config.disabledTeamEventTypes.has(`${p.installationTeamId}:${p.eventTypeId}`)) {
          return false;
        }
      }

      // Supplier Filter
      if (config.activeSupplierFilters && config.activeSupplierFilters.size < allSupplierIds.length) {
        if (p.supplierId && !config.activeSupplierFilters.has(p.supplierId)) {
          return false;
        }
      }

      return true;
    };

    const filterTestEvents = (config: FilterConfig) => {
      return testEvents.filter((e) => evaluateEvent(e, config));
    };

    // ─── T1: Domyślny stan (wszystko włączone, prywatne włączone) ────────────────
    const t1 = filterTestEvents({
      showPrivate: true,
      activeTeamFilters: new Set(allTeamIds),
      activeSupplierFilters: new Set(allSupplierIds),
    });
    expect(t1.length).toBe(6);

    // ─── T2: Wyszukiwarka tekstowa: 'Spotkanie' ──────────────────────────────────
    const t2 = filterTestEvents({
      showPrivate: true,
      searchQuery: "Spotkanie",
    });
    expect(t2.length).toBe(1);
    expect(t2[0].title).toBe("[DEV-TEST] Spotkanie handlowe");

    // ─── T3: Wyszukiwarka po fragmencie tytułu: 'Piotra' ─────────────────────────
    const t3 = filterTestEvents({
      showPrivate: true,
      searchQuery: "Piotra",
    });
    expect(t3.length).toBe(1);
    expect(t3[0].title).toBe("[DEV-TEST] Montaż u Piotra");

    // ─── T4: Filtr Użytkownika: tylko Jan Kowalski ──────────────────────────────
    const t4 = filterTestEvents({
      showPrivate: true,
      activeUserFilters: new Set([userJanId]),
    });
    // Jan ma przypisane: Wydarzenie 1 (Montaż u Piotra), Wydarzenie 3 (Spotkanie), Wydarzenie 5 (Prywatna)
    expect(t4.length).toBe(3);
    const t4Titles = t4.map((e) => e.title);
    expect(t4Titles).toContain("[DEV-TEST] Montaż u Piotra");
    expect(t4Titles).toContain("[DEV-TEST] Spotkanie handlowe");
    expect(t4Titles).toContain("[DEV-TEST] Notatka prywatna zarządu");

    // ─── T4b: Filtr Użytkownika: tylko Anna Nowak ────────────────────────────────
    const t4b = filterTestEvents({
      showPrivate: true,
      activeUserFilters: new Set([userAnnaId]),
    });
    // Anna ma przypisane: Wydarzenie 2 (Serwis reklamacyjny)
    expect(t4b.length).toBe(1);
    expect(t4b[0].title).toBe("[DEV-TEST] Serwis reklamacyjny");

    // ─── T5: Filtr Użytkownika: '__none__' (Bez przypisania) ────────────────────
    const t5 = filterTestEvents({
      showPrivate: true,
      activeUserFilters: new Set(["__none__"]),
    });
    // Wydarzenie 4 (Rozładunek profili) i Wydarzenie 6 (Zadanie bez przypisania) mają assignedUserIds: []
    expect(t5.length).toBe(2);
    const t5Titles = t5.map((e) => e.title);
    expect(t5Titles).toContain("[DEV-TEST] Rozładunek profili");
    expect(t5Titles).toContain("[DEV-TEST] Zadanie bez przypisania");

    // ─── T6: Filtr Typu Wydarzenia: odznaczenie 'Montaż' ────────────────────────
    const allTypeIds = new Set([montazTypeId, serwisTypeId, typeSpotkanieId, typeDostawaId]);
    const withoutMontaz = new Set(allTypeIds);
    withoutMontaz.delete(montazTypeId);

    const t6 = filterTestEvents({
      showPrivate: true,
      activeEventTypeFilters: withoutMontaz,
    });
    // Zdarzenia 1 i 5 (o typie Montaż) powinny zniknąć
    expect(t6.length).toBe(4);
    const t6Titles = t6.map((e) => e.title);
    expect(t6Titles).not.toContain("[DEV-TEST] Montaż u Piotra");
    expect(t6Titles).not.toContain("[DEV-TEST] Notatka prywatna zarządu");

    // ─── T7: Filtr Ekipy: odznaczenie Ekipa Alfa ────────────────────────────────
    const t7 = filterTestEvents({
      showPrivate: true,
      activeTeamFilters: new Set([teamBetaId]), // tylko Beta aktywna
    });
    // Wydarzenie 1 (Ekipa Alfa) znika, Wydarzenie 2 (Ekipa Beta) zostaje, zdarzenia bez ekipy zostają
    expect(t7.map((e) => e.title)).not.toContain("[DEV-TEST] Montaż u Piotra");
    expect(t7.map((e) => e.title)).toContain("[DEV-TEST] Serwis reklamacyjny");

    // ─── T8: Podfiltr zadania ekipy: wyłączenie Montażu dla Ekipy Alfa ──────────
    const t8 = filterTestEvents({
      showPrivate: true,
      activeTeamFilters: new Set(allTeamIds),
      disabledTeamEventTypes: new Set([`${teamAlfaId}:${montazTypeId}`]),
    });
    // Wydarzenie 1 (Montaż w Ekipie Alfa) znika
    expect(t8.map((e) => e.title)).not.toContain("[DEV-TEST] Montaż u Piotra");
    expect(t8.map((e) => e.title)).toContain("[DEV-TEST] Serwis reklamacyjny");

    // ─── T9: Filtr Dostawcy: odznaczenie Dostawca Profili ────────────────────────
    const t9 = filterTestEvents({
      showPrivate: true,
      activeSupplierFilters: new Set([]), // brak aktywnych dostawców
    });
    // Wydarzenie 4 (powiązane z Dostawcą Profili) znika
    expect(t9.map((e) => e.title)).not.toContain("[DEV-TEST] Rozładunek profili");

    // ─── T10: Filtr Prywatne: showPrivate = false ───────────────────────────────
    const t10 = filterTestEvents({
      showPrivate: false,
    });
    // Wydarzenie 5 (isPrivate: true) znika
    expect(t10.map((e) => e.title)).not.toContain("[DEV-TEST] Notatka prywatna zarządu");
    expect(t10.length).toBe(5);

    // ─── Czyszczenie bazy (cleanup) ─────────────────────────────────────────────
    const cleanupResult = await t.mutation(api.devCalendarTestSeed.cleanupDevCalendarData, {});
    expect(cleanupResult.status).toBe("cleaned");
    expect(cleanupResult.deletedCount).toBeGreaterThanOrEqual(6);

    const afterCleanup = await asUser.query(api.calendarEvents.getEvents, {
      startDate,
      endDate,
    });
    const remainingDevEvents = afterCleanup.filter((e) => e.description === "DEV_TEST_SEED");
    expect(remainingDevEvents.length).toBe(0);
  });
});
