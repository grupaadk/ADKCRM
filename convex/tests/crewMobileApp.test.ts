/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("crewMobileApp", () => {
  test("authenticates team by PIN, gets crew schedule, and updates status", async () => {
    const t = convexTest(schema, modules);

    // Create a user for authenticated mutations
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test Admin",
        email: "admin@test.pl",
        role: "admin",
        isActive: true,
      });
    });

    const asUser = t.withIdentity({ subject: userId });

    // 1. Create Team with PIN
    const teamId = await t.mutation(api.installationTeams.create, {
      name: "Ekipa Szybka",
      color: "#10b981",
      leaderName: "Marek Kowal",
      phone: "+48 500 600 700",
      pin: "4321",
      isActive: true,
    });

    // 2. Create Client and Order assigned to team
    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Nowak",
        source: "manual",
        createdBy: userId,
      });
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });
    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        name: "Montaż okien u Kowalskiego",
        installationTeamId: teamId,
        status: "installation",
        projectEndDate: Date.now() + 86400000,
      });
    });

    // 3. Verify PIN query
    const verifyValid = await t.query(api.installationTeams.verifyPin, { pin: "4321" });
    expect(verifyValid.success).toBe(true);
    expect(verifyValid.team?.name).toBe("Ekipa Szybka");

    const verifyInvalid = await t.query(api.installationTeams.verifyPin, { pin: "0000" });
    expect(verifyInvalid.success).toBe(false);

    // 4. Fetch schedule by PIN
    const schedule = await t.query(api.installationTeams.getScheduleByPin, { pin: "4321" });
    expect(schedule).not.toBeNull();
    expect(schedule?.team.name).toBe("Ekipa Szybka");
    expect(schedule?.items).toHaveLength(1);
    expect(schedule?.items[0].status).toBe("installation");

    // 5. Update order status by PIN
    await t.mutation(api.installationTeams.updateOrderStatusByPin, {
      pin: "4321",
      orderId,
      newStatus: "completed",
    });

    const updatedSchedule = await t.query(api.installationTeams.getScheduleByPin, { pin: "4321" });
    expect(updatedSchedule?.items[0].status).toBe("completed");

    // 6. Update with wrong PIN should fail
    await expect(
      t.mutation(api.installationTeams.updateOrderStatusByPin, {
        pin: "9999",
        orderId,
        newStatus: "installation",
      })
    ).rejects.toThrow("Nieprawidłowy kod PIN ekipy.");
  });
});
