import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const emptyDocuments = {
  pomiar: { enabled: false },
  umowa: { enabled: false },
  gwarancja_alco: { enabled: false },
  rekojmia_adk: { enabled: false },
  odbior_inwestor: { enabled: false },
  protokol_montaz: { enabled: false },
  faktura: { enabled: false },
  reklamacja: { enabled: false },
};

describe("Order Installation Gantt (convex/installationGantt)", () => {
  test("creates, seeds, updates, reorders and deletes stages independently from CRM calendar", async () => {
    const t = convexTest(schema);

    const { orderId, teamId } = await t.run(async (ctx) => {
      const clientId = await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Nowak",
        source: "manual",
        createdBy: "test",
      });
      const teamId = await ctx.db.insert("installationTeams", {
        name: "Ekipa Alfa",
        color: "#0891b2",
        isActive: true,
        createdAt: Date.now(),
      });
      const orderId = await ctx.db.insert("orders", {
        clientId,
        name: "Pergola Tarasowa",
        status: "production",
        source: "manual",
        documents: emptyDocuments,
        createdBy: "test",
      });
      return { orderId, teamId };
    });

    const anchor = new Date(2026, 10, 16, 14, 30, 0).getTime();
    const seedRes = await t.mutation(api.installationGantt.seedPresetStages, {
      orderId,
      anchorDate: anchor,
      defaultTeamId: teamId,
    });
    expect(seedRes.created).toBe(4);

    // Idempotentność seedowania gdy etapy już istnieją
    const seedAgain = await t.mutation(api.installationGantt.seedPresetStages, {
      orderId,
      anchorDate: anchor,
      defaultTeamId: teamId,
    });
    expect(seedAgain.created).toBe(0);

    const stages = await t.query(api.installationGantt.listByOrder, { orderId });
    expect(stages).toHaveLength(4);
    expect(stages[0].title).toBe("Przygotowanie i kotwienie");
    expect(stages[0].status).toBe("planned");
    expect(stages[0].conflicts).toHaveLength(0);

    // Przesunięcie etapu i zmiana statusu
    const newStart = new Date(2026, 10, 20, 0, 0, 0).getTime();
    const newEnd = new Date(2026, 10, 22, 0, 0, 0).getTime();
    await t.mutation(api.installationGantt.updateStage, {
      stageId: stages[0]._id,
      startDate: newStart,
      endDate: newEnd,
      status: "done",
      note: "Zakończone przed czasem",
    });

    // Dodanie nowego etapu
    const customId = await t.mutation(api.installationGantt.createStage, {
      orderId,
      title: "Montaż LED",
      startDate: new Date(2026, 10, 23, 0, 0, 0).getTime(),
      endDate: new Date(2026, 10, 23, 0, 0, 0).getTime(),
      installationTeamId: teamId,
    });

    const afterCreate = await t.query(api.installationGantt.listByOrder, { orderId });
    expect(afterCreate).toHaveLength(5);
    expect(afterCreate[0].status).toBe("done");
    expect(afterCreate[0].startDate).toBe(newStart);
    expect(afterCreate[0].endDate).toBe(newEnd);

    // Zmiana kolejności (przesunięcie nowego etapu na początek)
    const reorderedIds = [customId, ...stages.map((s) => s._id)];
    await t.mutation(api.installationGantt.reorderStages, {
      orderId,
      orderedIds: reorderedIds,
    });
    const afterReorder = await t.query(api.installationGantt.listByOrder, { orderId });
    expect(afterReorder[0]._id).toBe(customId);

    // Usunięcie etapu
    await t.mutation(api.installationGantt.removeStage, { stageId: customId });
    const afterRemove = await t.query(api.installationGantt.listByOrder, { orderId });
    expect(afterRemove).toHaveLength(4);

    // Sprawdzenie niezależności od order.installationDates
    const orderDoc = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(orderDoc?.installationDates).toBeUndefined();
  });

  test("detects installation team conflicts across other orders (both Gantt and Calendar dates)", async () => {
    const t = convexTest(schema);

    const { order1Id, order2Id, order3Id, teamId } = await t.run(async (ctx) => {
      const c1 = await ctx.db.insert("clients", {
        firstName: "Anna",
        lastName: "Kowalska",
        source: "manual",
        createdBy: "test",
      });
      const c2 = await ctx.db.insert("clients", {
        firstName: "Marek",
        lastName: "Zieliński",
        source: "manual",
        createdBy: "test",
      });
      const teamId = await ctx.db.insert("installationTeams", {
        name: "Ekipa Beta",
        color: "#f59e0b",
        isActive: true,
        createdAt: Date.now(),
      });
      const order1Id = await ctx.db.insert("orders", {
        clientId: c1,
        name: "Zadaszenie #1",
        status: "production",
        source: "manual",
        documents: emptyDocuments,
        createdBy: "test",
      });
      const order2Id = await ctx.db.insert("orders", {
        clientId: c2,
        name: "Pergola #2",
        status: "production",
        source: "manual",
        documents: emptyDocuments,
        createdBy: "test",
      });
      const order3Id = await ctx.db.insert("orders", {
        clientId: c2,
        name: "Zabudowa #3",
        status: "installation",
        source: "manual",
        documents: emptyDocuments,
        createdBy: "test",
        installationDates: [
          {
            date: new Date(2026, 10, 18, 0, 0, 0).getTime(),
            startMins: 480,
            endMins: 960,
            installationTeamId: teamId,
          },
        ],
      });
      return { order1Id, order2Id, order3Id, teamId };
    });

    // Etap na zleceniu 1: 17-19 listopada
    await t.mutation(api.installationGantt.createStage, {
      orderId: order1Id,
      title: "Konstrukcja #1",
      startDate: new Date(2026, 10, 17, 0, 0, 0).getTime(),
      endDate: new Date(2026, 10, 19, 0, 0, 0).getTime(),
      installationTeamId: teamId,
    });

    // Etap na zleceniu 2: 19-21 listopada (nakłada się 19.11 ze zleceniem 1)
    await t.mutation(api.installationGantt.createStage, {
      orderId: order2Id,
      title: "Konstrukcja #2",
      startDate: new Date(2026, 10, 19, 0, 0, 0).getTime(),
      endDate: new Date(2026, 10, 21, 0, 0, 0).getTime(),
      installationTeamId: teamId,
    });

    const stagesOrder1 = await t.query(api.installationGantt.listByOrder, { orderId: order1Id });
    expect(stagesOrder1).toHaveLength(1);
    // Powinno wykryć 2 kolizje: ze zleceniem #2 (Gantt) oraz #3 (Kalendarz CRM 18.11)
    expect(stagesOrder1[0].conflicts).toHaveLength(2);
    expect(stagesOrder1[0].conflicts.some((c) => c.orderId === order2Id && c.source === "gantt")).toBe(
      true
    );
    expect(stagesOrder1[0].conflicts.some((c) => c.orderId === order3Id && c.source === "calendar")).toBe(
      true
    );
  });
});
