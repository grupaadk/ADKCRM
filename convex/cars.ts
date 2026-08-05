import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCars = query({
  args: {},
  handler: async (ctx) => {
    const cars = await ctx.db
      .query("cars")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Map to include team names if assigned
    const carsWithTeams = await Promise.all(
      cars.map(async (car) => {
        let teamName = null;
        if (car.assignedInstallationTeamId) {
          const team = await ctx.db.get(car.assignedInstallationTeamId);
          teamName = team?.name || null;
        }
        return { ...car, teamName };
      })
    );

    return carsWithTeams;
  },
});

export const getCarById = query({
  args: { carId: v.id("cars") },
  handler: async (ctx, args) => {
    const car = await ctx.db.get(args.carId);
    if (!car) throw new Error("Car not found");

    let teamName = null;
    if (car.assignedInstallationTeamId) {
      const team = await ctx.db.get(car.assignedInstallationTeamId);
      teamName = team?.name || null;
    }

    return { ...car, teamName };
  },
});

export const createCar = mutation({
  args: {
    make: v.string(),
    model: v.string(),
    registrationNumber: v.string(),
    vin: v.optional(v.string()),
    year: v.optional(v.number()),
    assignedInstallationTeamId: v.optional(v.id("installationTeams")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cars", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateCar = mutation({
  args: {
    carId: v.id("cars"),
    make: v.string(),
    model: v.string(),
    registrationNumber: v.string(),
    vin: v.optional(v.string()),
    year: v.optional(v.number()),
    assignedInstallationTeamId: v.optional(v.id("installationTeams")),
  },
  handler: async (ctx, args) => {
    const { carId, ...updates } = args;
    await ctx.db.patch(carId, updates);
  },
});

export const deleteCar = mutation({
  args: { carId: v.id("cars") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.carId, { isActive: false });
  },
});

export const getCarEvents = query({
  args: { carId: v.id("cars") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("carEvents")
      .withIndex("by_car", (q) => q.eq("carId", args.carId))
      .order("desc")
      .collect();
  },
});

export const createCarEvent = mutation({
  args: {
    carId: v.id("cars"),
    type: v.union(
      v.literal("refueling"),
      v.literal("inspection"),
      v.literal("repair"),
      v.literal("other")
    ),
    date: v.number(),
    cost: v.number(),
    description: v.optional(v.string()),
    mileage: v.optional(v.number()),
    addToCalendar: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { addToCalendar, ...eventData } = args;
    
    let linkedCalendarEventId;

    if (addToCalendar) {
      // Find "Administracja" calendar event type
      const eventTypes = await ctx.db.query("calendarEventTypes").collect();
      let adminEventType = eventTypes.find((t) => t.name === "Administracja");
      
      // If it doesn't exist, create it
      if (!adminEventType) {
        const newTypeId = await ctx.db.insert("calendarEventTypes", {
          name: "Administracja",
          color: "#9ca3af", // Gray color
          isPrivate: false,
          createdAt: Date.now(),
        });
        adminEventType = (await ctx.db.get(newTypeId))!;
      }

      const car = await ctx.db.get(args.carId);
      const title = `${args.type === 'inspection' ? 'Przegląd' : args.type === 'repair' ? 'Naprawa' : args.type === 'refueling' ? 'Tankowanie' : 'Inne'}: ${car?.registrationNumber}`;
      
      const identity = await ctx.auth.getUserIdentity();
      // If no identity, we might fallback to some default user if required by schema. 
      // The schema for calendarEvents requires createdBy: v.id("users").
      // Since it's admin, they should be logged in. We need their user ID.
      let createdBy = null;
      if (identity && identity.subject) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
          .first();
        if (user) {
          createdBy = user._id;
        }
      }

      if (createdBy) {
        linkedCalendarEventId = await ctx.db.insert("calendarEvents", {
          eventTypeId: adminEventType._id,
          title: title,
          description: args.description || `Zdarzenie dla pojazdu ${car?.make} ${car?.model} (${car?.registrationNumber})`,
          startDate: args.date,
          isAllDay: true,
          createdBy: createdBy,
          isPrivate: false,
          createdAt: Date.now(),
        });
      } else {
        console.warn("User not found, could not create calendar event for car.");
      }
    }

    return await ctx.db.insert("carEvents", {
      ...eventData,
      linkedCalendarEventId,
      createdAt: Date.now(),
    });
  },
});

export const deleteCarEvent = mutation({
  args: { eventId: v.id("carEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (event?.linkedCalendarEventId) {
      await ctx.db.delete(event.linkedCalendarEventId);
    }
    await ctx.db.delete(args.eventId);
  },
});
