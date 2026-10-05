import { expect, test, describe } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

describe("Complaints module", () => {
  test("creates custom client complaint and lists complaints correctly", async () => {
    const t = convexTest(schema);

    const complaintId = await t.mutation(api.complaints.create, {
      customClientName: "Jan Kowalski (Custom)",
      customClientAddress: "ul. Testowa 12, Warszawa",
      customClientPhone: "500 600 700",
      description: "Uszkodzona szyba",
      startDate: Date.now(),
      createdBy: "Wojtek",
    });

    expect(complaintId).toBeDefined();

    const complaints = await t.query(api.complaints.getAll, { status: "aktualne" });
    expect(complaints.length).toBe(1);
    expect(complaints[0]._id).toBe(complaintId);
    expect(complaints[0].customClientName).toBe("Jan Kowalski (Custom)");
    expect(complaints[0].clientId).toBeUndefined();
    expect(complaints[0].status).toBe("aktualne");
  });

  test("migrates legacy statuses to new status model", async () => {
    const t = convexTest(schema);

    // Insert legacy complaint directly in DB
    const legacyId1 = await t.run(async (ctx) => {
      return await ctx.db.insert("complaints", {
        status: "nowa" as any,
        description: "Legacy active complaint",
        startDate: Date.now(),
        createdBy: "System",
        todos: [],
      });
    });

    const legacyId2 = await t.run(async (ctx) => {
      return await ctx.db.insert("complaints", {
        status: "zamknieta" as any,
        description: "Legacy closed complaint",
        startDate: Date.now(),
        createdBy: "System",
        todos: [],
      });
    });

    // Run migration
    const result = await t.mutation(api.complaints.migrateComplaintStatuses, {});
    expect(result.updatedCount).toBe(2);

    const c1 = await t.run(async (ctx) => ctx.db.get(legacyId1));
    const c2 = await t.run(async (ctx) => ctx.db.get(legacyId2));

    expect(c1?.status).toBe("aktualne");
    expect(c2?.status).toBe("archiwalne");
  });
});
