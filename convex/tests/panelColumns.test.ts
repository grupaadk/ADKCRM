import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("users.setCollapsedPanelColumns", () => {
  test("defaults to empty array in users.me and persists deduplicated column keys per user", async () => {
    const t = convexTest(schema);
    const { userAId, userBId } = await t.run(async (ctx) => {
      const a = await ctx.db.insert("users", {
        email: "usera@test.pl",
        displayName: "User A",
        role: "sales",
        isActive: true,
      });
      const b = await ctx.db.insert("users", {
        email: "userb@test.pl",
        displayName: "User B",
        role: "montaz",
        isActive: true,
      });
      return { userAId: a, userBId: b };
    });

    const asUserA = t.withIdentity({ subject: userAId });
    const asUserB = t.withIdentity({ subject: userBId });

    const initialA = await asUserA.query(api.users.me, {});
    expect(initialA?.collapsedPanelColumns).toEqual([]);

    const savedA = await asUserA.mutation(api.users.setCollapsedPanelColumns, {
      columns: [" production ", "installation", "production", "", "  "],
    });
    expect(savedA).toEqual(["production", "installation"]);

    const updatedA = await asUserA.query(api.users.me, {});
    expect(updatedA?.collapsedPanelColumns).toEqual(["production", "installation"]);

    // User B remains unaffected
    const initialB = await asUserB.query(api.users.me, {});
    expect(initialB?.collapsedPanelColumns).toEqual([]);

    await asUserB.mutation(api.users.setCollapsedPanelColumns, {
      columns: ["measurement"],
    });
    const updatedB = await asUserB.query(api.users.me, {});
    expect(updatedB?.collapsedPanelColumns).toEqual(["measurement"]);

    // User A still keeps their own preference
    const stillA = await asUserA.query(api.users.me, {});
    expect(stillA?.collapsedPanelColumns).toEqual(["production", "installation"]);
  });

  test("rejects unauthenticated callers", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.users.setCollapsedPanelColumns, {
        columns: ["production"],
      }),
    ).rejects.toThrow();
  });
});
