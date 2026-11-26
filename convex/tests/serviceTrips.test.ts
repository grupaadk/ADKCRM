/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("ServiceTrips module", () => {
  test("creates service trip, assigns complaint, reorders, and closes trip", async () => {
    const t = convexTest(schema, modules);

    // Create admin user in db so requireUser succeeds
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "wojtek@example.com",
        displayName: "Wojtek",
        role: "admin",
        isActive: true,
      });
    });

    const tUser = t.withIdentity({ subject: adminId });

    // Create client
    const clientId = await tUser.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
    });

    // Create 2 complaints
    const c1Id = await tUser.mutation(api.complaints.create, {
      clientId,
      startDate: Date.now(),
      description: "Usterka okna 1",
      createdBy: "Wojtek",
    });

    const c2Id = await tUser.mutation(api.complaints.create, {
      clientId,
      startDate: Date.now(),
      description: "Usterka drzwi 2",
      createdBy: "Wojtek",
    });

    // List unassigned complaints
    const unassigned = await tUser.query(api.serviceTrips.getUnassignedComplaints, {});
    expect(unassigned.length).toBeGreaterThanOrEqual(2);

    // Create service trip
    const tripId = await tUser.mutation(api.serviceTrips.create, {
      name: "Wyjazd Kraków",
      date: Date.now() + 86400000,
    });
    expect(tripId).toBeDefined();

    // Assign c1 and c2 to trip
    await tUser.mutation(api.serviceTrips.assignComplaint, { complaintId: c1Id, tripId });
    await tUser.mutation(api.serviceTrips.assignComplaint, { complaintId: c2Id, tripId });

    // Get trip details with complaints
    const tripWithComplaints = await tUser.query(api.serviceTrips.getWithComplaints, { tripId });
    expect(tripWithComplaints).not.toBeNull();
    expect(tripWithComplaints?.complaints.length).toBe(2);
    expect(tripWithComplaints?.complaints[0]._id).toBe(c1Id);
    expect(tripWithComplaints?.complaints[1]._id).toBe(c2Id);

    // Reorder complaints (c2 first, c1 second)
    await tUser.mutation(api.serviceTrips.reorder, {
      tripId,
      orderedIds: [c2Id, c1Id],
    });

    const reorderedTrip = await tUser.query(api.serviceTrips.getWithComplaints, { tripId });
    expect(reorderedTrip?.complaints[0]._id).toBe(c2Id);
    expect(reorderedTrip?.complaints[1]._id).toBe(c1Id);

    // Close trip
    await tUser.mutation(api.serviceTrips.close, { tripId });
    const closedTrip = await tUser.query(api.serviceTrips.getWithComplaints, { tripId });
    expect(closedTrip?.status).toBe("closed");

    // Verify assigned complaints status changed to 'archiwalne'
    const updatedC1 = await tUser.query(api.complaints.getById, { complaintId: c1Id });
    expect(updatedC1?.status).toBe("archiwalne");
  });

  test("updates service trip name and date for both open and closed trips and rejects empty name", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "wojtek@example.com",
        displayName: "Wojtek",
        role: "admin",
        isActive: true,
      });
    });

    const tUser = t.withIdentity({ subject: adminId });
    const initialDate = Date.UTC(2026, 9, 22);
    const updatedDate = Date.UTC(2026, 9, 29);

    const tripId = await tUser.mutation(api.serviceTrips.create, {
      name: "SRERWIS",
      date: initialDate,
    });

    // Rename open trip and update date
    await tUser.mutation(api.serviceTrips.update, {
      tripId,
      name: "  SERWIS — tydzień 44  ",
      date: updatedDate,
    });

    const renamedOpen = await tUser.query(api.serviceTrips.getWithComplaints, { tripId });
    expect(renamedOpen?.name).toBe("SERWIS — tydzień 44");
    expect(renamedOpen?.date).toBe(updatedDate);

    // Reject blank name
    await expect(
      tUser.mutation(api.serviceTrips.update, { tripId, name: "   " }),
    ).rejects.toThrow("Nazwa wyjazdu nie może być pusta.");

    // Close trip and verify rename still works on closed trips
    await tUser.mutation(api.serviceTrips.close, { tripId });
    await tUser.mutation(api.serviceTrips.update, {
      tripId,
      name: "SERWIS — archiwum",
    });

    const renamedClosed = await tUser.query(api.serviceTrips.getWithComplaints, { tripId });
    expect(renamedClosed?.status).toBe("closed");
    expect(renamedClosed?.name).toBe("SERWIS — archiwum");
  });
});
