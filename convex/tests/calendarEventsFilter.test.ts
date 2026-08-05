/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("Calendar events filtering for unfinished orders", () => {
  test("getLinkedOrderEvents and listForPicker exclude completed and archived orders", async () => {
    const t = convexTest(schema, modules);

    // Create test user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test Admin",
        email: "admin@example.com",
        role: "admin",
        isActive: true,
      });
    });

    const asUser = t.withIdentity({ subject: userId });

    // Create client
    const clientId = await asUser.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Kowalski",
        source: "manual",
        createdBy: userId,
      });
    });

    // Create active order (installation)
    const activeOrderId = await asUser.mutation(api.orders.create, { clientId });
    await asUser.run(async (ctx) => {
      await ctx.db.patch(activeOrderId, {
        name: "Active Order",
        status: "installation",
        projectStartDate: Date.now() - 3600000,
        projectEndDate: Date.now() + 3600000,
      });
    });

    // Create completed order
    const completedOrderId = await asUser.mutation(api.orders.create, { clientId });
    await asUser.run(async (ctx) => {
      await ctx.db.patch(completedOrderId, {
        name: "Completed Order",
        status: "completed",
        projectStartDate: Date.now() - 3600000,
        projectEndDate: Date.now() + 3600000,
      });
    });

    // Create archived order
    const archivedOrderId = await asUser.mutation(api.orders.create, { clientId });
    await asUser.run(async (ctx) => {
      await ctx.db.patch(archivedOrderId, {
        name: "Archived Order",
        status: "archived",
        projectStartDate: Date.now() - 3600000,
        projectEndDate: Date.now() + 3600000,
      });
    });

    // Create calendar event type for project end date
    const eventTypeId = await asUser.run(async (ctx) => {
      return await ctx.db.insert("calendarEventTypes", {
        name: "Montaż",
        color: "#14b8a6",
        isPrivate: false,
        linkedOrderField: "projectEndDate",
        createdAt: Date.now(),
      });
    });

    // Create custom calendar events (one for active, one for completed order)
    const activeEventId = await asUser.run(async (ctx) => {
      return await ctx.db.insert("calendarEvents", {
        eventTypeId,
        title: "Active Event",
        startDate: Date.now(),
        isAllDay: true,
        orderId: activeOrderId,
        createdBy: userId,
        isPrivate: false,
        createdAt: Date.now(),
      });
    });

    const completedEventId = await asUser.run(async (ctx) => {
      return await ctx.db.insert("calendarEvents", {
        eventTypeId,
        title: "Completed Order Event",
        startDate: Date.now(),
        isAllDay: true,
        orderId: completedOrderId,
        createdBy: userId,
        isPrivate: false,
        createdAt: Date.now(),
      });
    });

    // 1. Verify listForPicker
    const pickerOrders = await asUser.query(api.orders.listForPicker, {});
    const pickerOrderIds = pickerOrders.map((o) => o._id);
    expect(pickerOrderIds).toContain(activeOrderId);
    expect(pickerOrderIds).not.toContain(completedOrderId);
    expect(pickerOrderIds).not.toContain(archivedOrderId);

    // 2. Verify getLinkedOrderEvents
    const startDate = Date.now() - 86400000;
    const endDate = Date.now() + 86400000;

    const linkedEvents = await asUser.query(api.calendarEvents.getLinkedOrderEvents, {
      startDate,
      endDate,
    });
    const linkedOrderIds = linkedEvents.map((e) => e.orderId);
    expect(linkedOrderIds).toContain(activeOrderId);
    expect(linkedOrderIds).not.toContain(completedOrderId);
    expect(linkedOrderIds).not.toContain(archivedOrderId);

    // 3. Verify getEvents (custom events)
    const customEvents = await asUser.query(api.calendarEvents.getEvents, {
      startDate,
      endDate,
    });
    const customEventIds = customEvents.map((e) => e._id);
    expect(customEventIds).toContain(activeEventId);
    expect(customEventIds).not.toContain(completedEventId);
  });
});
