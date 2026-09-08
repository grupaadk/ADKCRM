import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("Moduł HR (Urlopy i Nadgodziny)", () => {
  test("pracownik może złożyć wniosek urlopowy i zgłosić nadgodziny", async () => {
    const t = convexTest(schema);

    // Stwórz użytkownika w bazie
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "pracownik@adkokna.pl",
        displayName: "Jan Kowalski",
        role: "sales",
        isActive: true,
      });
    });

    const userCtx = t.withIdentity({
      subject: userId,
      email: "pracownik@adkokna.pl",
    });

    // Złóż wniosek urlopowy
    const leaveId = await userCtx.mutation(api.hr.submitLeave, {
      type: "vacation",
      startDate: "2026-08-10",
      endDate: "2026-08-14",
      daysCount: 5,
      reason: "Urlop wypoczynkowy w górach",
    });
    expect(leaveId).toBeDefined();

    // Zgłoś nadgodziny
    const overtimeId = await userCtx.mutation(api.hr.submitOvertime, {
      date: "2026-08-05",
      hours: 3.5,
      description: "Dokończenie montażu rolet u klienta",
    });
    expect(overtimeId).toBeDefined();

    // Pobierz własne dane HR
    const myData = await userCtx.query(api.hr.getMyHrData, {});
    expect(myData.leaves).toHaveLength(1);
    expect(myData.leaves[0].status).toBe("pending");
    expect(myData.leaves[0].reason).toBe("Urlop wypoczynkowy w górach");

    expect(myData.overtime).toHaveLength(1);
    expect(myData.overtime[0].status).toBe("pending");
    expect(myData.overtime[0].hours).toBe(3.5);
  });

  test("administrator widzi wszystkie zgłoszenia i może je akceptować/odrzucać", async () => {
    const t = convexTest(schema);

    // Stwórz pracownika oraz admina
    const { workerId, adminId } = await t.run(async (ctx) => {
      const wId = await ctx.db.insert("users", {
        email: "pracownik2@adkokna.pl",
        displayName: "Piotr Nowak",
        role: "montaz",
        isActive: true,
      });
      const aId = await ctx.db.insert("users", {
        email: "admin@adkokna.pl",
        displayName: "Szef Admin",
        role: "admin",
        isActive: true,
      });
      return { workerId: wId, adminId: aId };
    });

    const workerCtx = t.withIdentity({
      subject: workerId,
      email: "pracownik2@adkokna.pl",
    });

    const adminCtx = t.withIdentity({
      subject: adminId,
      email: "admin@adkokna.pl",
    });

    // Pracownik tworzy wniosek i nadgodziny
    const leaveId = await workerCtx.mutation(api.hr.submitLeave, {
      type: "sick",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      daysCount: 3,
      reason: "Zwolnienie L4",
    });

    const overtimeId = await workerCtx.mutation(api.hr.submitOvertime, {
      date: "2026-08-04",
      hours: 2,
      description: "Prace serwisowe",
    });

    // Admin pobiera wszystkie dane HR
    const allData = await adminCtx.query(api.hr.getAllHrData, {});
    expect(allData.leaves).toHaveLength(1);
    expect(allData.leaves[0].userName).toBe("Piotr Nowak");
    expect(allData.overtime).toHaveLength(1);

    // Admin akceptuje urlop i odrzuca nadgodziny
    await adminCtx.mutation(api.hr.updateLeaveStatus, {
      leaveId,
      status: "approved",
    });

    await adminCtx.mutation(api.hr.updateOvertimeStatus, {
      overtimeId,
      status: "rejected",
    });

    // Sprawdź statusy
    const updatedMyData = await workerCtx.query(api.hr.getMyHrData, {});
    expect(updatedMyData.leaves[0].status).toBe("approved");
    expect(updatedMyData.overtime[0].status).toBe("rejected");
  });

  test("pracownik bez roli admin nie ma dostępu do getAllHrData", async () => {
    const t = convexTest(schema);

    const workerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "zwykly@adkokna.pl",
        role: "sales",
        isActive: true,
      });
    });

    const workerCtx = t.withIdentity({ subject: workerId });

    await expect(workerCtx.query(api.hr.getAllHrData, {})).rejects.toThrow("Forbidden");
  });

  test("administrator może ustawić limit urlopowy pracownika i wyliczenia wykrywają przekroczenie limitu", async () => {
    const t = convexTest(schema);

    const { workerId, adminId } = await t.run(async (ctx) => {
      const wId = await ctx.db.insert("users", {
        email: "pracownik3@adkokna.pl",
        displayName: "Adam Zieliński",
        role: "sales",
        isActive: true,
      });
      const aId = await ctx.db.insert("users", {
        email: "admin2@adkokna.pl",
        displayName: "Główny Admin",
        role: "admin",
        isActive: true,
      });
      return { workerId: wId, adminId: aId };
    });

    const workerCtx = t.withIdentity({ subject: workerId, email: "pracownik3@adkokna.pl" });
    const adminCtx = t.withIdentity({ subject: adminId, email: "admin2@adkokna.pl" });

    // Domyślny limit to 26
    const initialWorkerData = await workerCtx.query(api.hr.getMyHrData, {});
    expect(initialWorkerData.vacationAllowance).toBe(26);

    // Admin ustawia limit na 15 dni
    await adminCtx.mutation(api.hr.setEmployeeVacationAllowance, {
      userId: workerId,
      daysCount: 15,
    });

    // Sprawdź po ustawieniu
    const updatedWorkerData = await workerCtx.query(api.hr.getMyHrData, {});
    expect(updatedWorkerData.vacationAllowance).toBe(15);

    // Pracownik składa wniosek na 10 dni
    const leave1Id = await workerCtx.mutation(api.hr.submitLeave, {
      type: "vacation",
      startDate: "2026-06-01",
      endDate: "2026-06-12",
      daysCount: 10,
    });

    // Admin akceptuje wniosek
    await adminCtx.mutation(api.hr.updateLeaveStatus, {
      leaveId: leave1Id,
      status: "approved",
    });

    // Sprawdź w przeglądzie pracowników admina
    const overview = await adminCtx.query(api.hr.getEmployeesHrOverview, {});
    const workerOverview = overview.find((u) => u._id === workerId);
    expect(workerOverview).toBeDefined();
    expect(workerOverview?.vacationAllowance).toBe(15);
    expect(workerOverview?.approvedVacationDays).toBe(10);
    expect(workerOverview?.remainingVacationDays).toBe(5);
    expect(workerOverview?.isOverLimit).toBe(false);

    // Pracownik składa kolejny wniosek na 7 dni (łącznie 17 > 15)
    await workerCtx.mutation(api.hr.submitLeave, {
      type: "vacation",
      startDate: "2026-07-01",
      endDate: "2026-07-09",
      daysCount: 7,
    });

    // Weryfikacja ostrzeżenia o przekroczeniu limitu (isOverLimit)
    const overviewAfterSecond = await adminCtx.query(api.hr.getEmployeesHrOverview, {});
    const workerOverviewAfterSecond = overviewAfterSecond.find((u) => u._id === workerId);
    expect(workerOverviewAfterSecond?.isOverLimit).toBe(true);

    const allHr = await adminCtx.query(api.hr.getAllHrData, {});
    const pendingLeave = allHr.leaves.find((l) => l.userId === workerId && l.status === "pending");
    expect(pendingLeave?.isOverLimit).toBe(true);
  });
});
