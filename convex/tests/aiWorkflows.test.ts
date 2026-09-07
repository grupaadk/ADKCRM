/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("aiWorkflows", () => {
  test("creates and activates workflow with advanced precision nodes", async () => {
    const t = convexTest(schema, modules);

    // Insert admin user record into database
    let adminId: string = "";
    await t.run(async (ctx) => {
      adminId = await ctx.db.insert("users", {
        email: "admin@adkokna.pl",
        name: "Admin User",
        displayName: "Admin User",
        role: "admin",
        isActive: true,
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });

    // Save workflow draft with all new node types
    const wfId = await asAdmin.mutation(api.aiWorkflows.saveWorkflowDraft, {
      serviceType: "Zabudowa tarasu",
      title: "Precyzyjna Wycena Tarasów v2",
      description: "Workflow z bramkami walidacyjnymi i warunkami B2B/B2C",
      nodes: [
        {
          id: "node-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { label: "Wyzwolenie" },
        },
        {
          id: "node-2",
          type: "input_required",
          position: { x: 100, y: 0 },
          data: {
            label: "Wymagane dane zadaszenia",
            requiredFields: ["widthCm", "lengthCm", "material"],
            inputPrompt: "Zapytaj o dokładne wymiary w cm oraz materiał dachu",
          },
        },
        {
          id: "node-3",
          type: "condition_branch",
          position: { x: 200, y: 0 },
          data: {
            label: "Sprawdź typ klienta",
            conditionVariable: "clientType",
            conditionOperator: "==",
            conditionValue: "business",
          },
        },
        {
          id: "node-4",
          type: "validation_gate",
          position: { x: 300, y: 0 },
          data: {
            label: "Walidator wymiarów dachu",
            validationMinWidth: 300,
            validationMaxWidth: 500,
            validationMinLength: 306,
            validationMaxLength: 1206,
            validationErrorMessage: "Wymiar przekracza cennik standardowy. Konieczna wycena indywidualna.",
          },
        },
        {
          id: "node-5",
          type: "discount_rule",
          position: { x: 400, y: 0 },
          data: {
            label: "Rabat wolumenowy",
            discountConditionType: "net_total",
            discountThreshold: 15000,
            discountPercent: 5,
          },
        },
        {
          id: "node-6",
          type: "price_modifier",
          position: { x: 500, y: 0 },
          data: {
            label: "Dopłata za kolor RAL niestandardowy",
            modifierName: "Kolor niestandardowy RAL",
            modifierType: "percent",
            modifierValue: 15,
            modifierCategory: "service",
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" },
        { id: "e2-3", source: "node-2", target: "node-3" },
        { id: "e3-4", source: "node-3", target: "node-4" },
        { id: "e4-5", source: "node-4", target: "node-5" },
        { id: "e5-6", source: "node-5", target: "node-6" },
      ],
    });

    expect(wfId).toBeDefined();

    // Verify fetched workflow
    const wf = await t.query(api.aiWorkflows.getWorkflow, { workflowId: wfId });
    expect(wf?.title).toBe("Precyzyjna Wycena Tarasów v2");
    expect(wf?.nodes).toHaveLength(6);

    // Activate workflow
    await asAdmin.mutation(api.aiWorkflows.activateWorkflow, { id: wfId });

    // Query active workflow for service
    const active = await t.query(api.aiWorkflows.getActiveWorkflowForService, {
      serviceType: "Zabudowa tarasu",
    });
    expect(active?._id).toBe(wfId);
    expect(active?.status).toBe("active");
  });
});
