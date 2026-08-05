/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("installationTeams", () => {
  test("creates, lists, updates, and deletes installation teams with PIN", async () => {
    const t = convexTest(schema, modules);

    // Create team with 4-digit PIN
    const teamId = await t.mutation(api.installationTeams.create, {
      name: "Ekipa Montażowa A",
      color: "#10b981",
      leaderName: "Jan Kowalski",
      phone: "+48 600 111 222",
      members: ["Piotr Nowak", "Adam Wiśniewski"],
      pin: "1234",
      isActive: true,
    });

    expect(teamId).toBeDefined();

    // List all
    const all = await t.query(api.installationTeams.listAll, {});
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Ekipa Montażowa A");
    expect(all[0].leaderName).toBe("Jan Kowalski");
    expect(all[0].pin).toBe("1234");

    // List active
    const active = await t.query(api.installationTeams.listActive, {});
    expect(active).toHaveLength(1);

    // Update PIN
    await t.mutation(api.installationTeams.update, {
      id: teamId,
      name: "Ekipa Montażowa Alfa",
      color: "#3b82f6",
      leaderName: "Jan Kowalski",
      phone: "+48 600 111 222",
      members: ["Piotr Nowak"],
      pin: "9876",
      isActive: false,
    });

    const activeAfterDeactivate = await t.query(api.installationTeams.listActive, {});
    expect(activeAfterDeactivate).toHaveLength(0);

    const allAfterUpdate = await t.query(api.installationTeams.listAll, {});
    expect(allAfterUpdate[0].name).toBe("Ekipa Montażowa Alfa");
    expect(allAfterUpdate[0].color).toBe("#3b82f6");
    expect(allAfterUpdate[0].pin).toBe("9876");

    // Invalid PIN length should fail
    await expect(
      t.mutation(api.installationTeams.create, {
        name: "Błędna Ekipa",
        pin: "123",
        isActive: true,
      })
    ).rejects.toThrow("PIN do aplikacji mobilnej musi składać się z dokładnie 4 cyfr.");

    // Delete
    await t.mutation(api.installationTeams.remove, { id: teamId });
    const allAfterDelete = await t.query(api.installationTeams.listAll, {});
    expect(allAfterDelete).toHaveLength(0);
  });
});
