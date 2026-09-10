/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("taskTemplates", () => {
  test("creates, lists, reorders items, updates and removes task templates", async () => {
    const t = convexTest(schema, modules);

    // Create admin user in DB
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@adkokna.pl",
        displayName: "Admin User",
        role: "admin",
        isActive: true,
      });
    });

    const adminCtx = t.withIdentity({
      subject: adminId,
      email: "admin@adkokna.pl",
    });

    // Create a template with initial item order
    const templateId = await adminCtx.mutation(api.taskTemplates.create, {
      name: "Montaż okien",
      items: [
        { title: "Krok 1: Pomiar otworu" },
        { title: "Krok 2: Przygotowanie podłoża" },
        { title: "Krok 3: Osadzenie ramy" },
      ],
    });

    expect(templateId).toBeDefined();

    // List templates
    const templates = await adminCtx.query(api.taskTemplates.list, {});
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("Montaż okien");
    expect(templates[0].items).toHaveLength(3);
    expect(templates[0].items[0].title).toBe("Krok 1: Pomiar otworu");

    // Update template with reordered items
    const reorderedItems = [
      { title: "Krok 2: Przygotowanie podłoża" },
      { title: "Krok 1: Pomiar otworu" },
      { title: "Krok 3: Osadzenie ramy" },
    ];
    await adminCtx.mutation(api.taskTemplates.update, {
      templateId,
      items: reorderedItems,
    });

    const updatedTemplates = await adminCtx.query(api.taskTemplates.list, {});
    expect(updatedTemplates[0].items[0].title).toBe("Krok 2: Przygotowanie podłoża");
    expect(updatedTemplates[0].items[1].title).toBe("Krok 1: Pomiar otworu");

    // Remove template
    await adminCtx.mutation(api.taskTemplates.remove, { templateId });
    const afterDelete = await adminCtx.query(api.taskTemplates.list, {});
    expect(afterDelete).toHaveLength(0);
  });
});
