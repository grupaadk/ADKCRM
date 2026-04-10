import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("viewConfig", () => {
  test("getForUser returns null when no config exists", async () => {
    const t = convexTest(schema);

    const config = await t.query(api.viewConfig.getForUser, {});
    expect(config).toBeNull();
  });

  test("save creates new config for user", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "firstName", "city", "status"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.userId).toBe("user-1");
    expect(config!.viewType).toBe("table");
    expect(config!.columns).toEqual([
      "lastName",
      "firstName",
      "city",
      "status",
    ]);
    expect(config!.sortBy).toEqual({ field: "lastName", direction: "asc" });
  });

  test("save updates existing config (upsert)", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "firstName"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "firstName", "status", "city"],
      sortBy: { field: "city", direction: "desc" },
      groupBy: "status",
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.viewType).toBe("table");
    expect(config!.columns).toEqual([
      "lastName",
      "firstName",
      "status",
      "city",
    ]);
    expect(config!.sortBy).toEqual({ field: "city", direction: "desc" });
    expect(config!.groupBy).toBe("status");
  });

  test("updateViewType creates config if none exists", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-new" });

    await asUser.mutation(api.viewConfig.updateViewType, {
      viewType: "table",
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.viewType).toBe("table");
    expect(config!.columns).toContain("lastName");
    expect(config!.columns).toContain("firstName");
  });

  test("updateViewType updates just viewType on existing config", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "email"],
      sortBy: { field: "email", direction: "desc" },
    });

    await asUser.mutation(api.viewConfig.updateViewType, {
      viewType: "table",
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.viewType).toBe("table");
    expect(config!.columns).toEqual(["lastName", "email"]);
    expect(config!.sortBy).toEqual({ field: "email", direction: "desc" });
  });

  test("updateColumns updates just columns", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    await asUser.mutation(api.viewConfig.updateColumns, {
      columns: ["firstName", "lastName", "phone", "email"],
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.columns).toEqual([
      "firstName",
      "lastName",
      "phone",
      "email",
    ]);
    expect(config!.viewType).toBe("table");
  });

  test("updateSort updates just sortBy", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "city"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    await asUser.mutation(api.viewConfig.updateSort, {
      sortBy: { field: "city", direction: "desc" },
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.sortBy).toEqual({ field: "city", direction: "desc" });
    expect(config!.viewType).toBe("table");
    expect(config!.columns).toEqual(["lastName", "city"]);
  });

  test("updateFilters updates just filters", async () => {
    const t = convexTest(schema);
    const asUser = t.withIdentity({ subject: "user-1" });

    await asUser.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName", "status"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    await asUser.mutation(api.viewConfig.updateFilters, {
      filters: [
        { field: "status", value: "lead" },
        { field: "city", value: "Warszawa" },
      ],
    });

    const config = await asUser.query(api.viewConfig.getForUser, {});
    expect(config).not.toBeNull();
    expect(config!.filters).toEqual([
      { field: "status", value: "lead" },
      { field: "city", value: "Warszawa" },
    ]);
    expect(config!.viewType).toBe("table");
  });

  test("different users have separate configs", async () => {
    const t = convexTest(schema);
    const alice = t.withIdentity({ subject: "user-alice" });
    const bob = t.withIdentity({ subject: "user-bob" });

    await alice.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["lastName"],
      sortBy: { field: "lastName", direction: "asc" },
    });

    await bob.mutation(api.viewConfig.save, {
      viewType: "table",
      columns: ["firstName", "status"],
      sortBy: { field: "firstName", direction: "desc" },
      groupBy: "status",
    });

    const aliceConfig = await alice.query(api.viewConfig.getForUser, {});
    const bobConfig = await bob.query(api.viewConfig.getForUser, {});

    expect(aliceConfig).not.toBeNull();
    expect(bobConfig).not.toBeNull();
    expect(aliceConfig!.viewType).toBe("table");
    expect(bobConfig!.viewType).toBe("table");
    expect(aliceConfig!.columns).toEqual(["lastName"]);
    expect(bobConfig!.columns).toEqual(["firstName", "status"]);
    expect(bobConfig!.groupBy).toBe("status");
  });
});
