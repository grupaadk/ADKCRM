import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

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
    if (!car) return null;

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
      
      const user = await getCurrentUser(ctx);
      const createdBy = user?._id || null;

      if (createdBy) {
        linkedCalendarEventId = await ctx.db.insert("calendarEvents", {
          eventTypeId: adminEventType._id,
          title: title,
          description: args.description || `Zdarzenie dla pojazdu ${car?.make} ${car?.model} (${car?.registrationNumber})`,
          startDate: args.date,
          isAllDay: true,
          carId: args.carId,
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

export const getTeamCarAndEventsByPin = query({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    if (!cleanPin || cleanPin.length !== 4) return null;

    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) return null;

    const cars = await ctx.db
      .query("cars")
      .withIndex("by_team", (q) => q.eq("assignedInstallationTeamId", team._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const car = cars[0] ?? null;
    if (!car) {
      return { team, car: null, events: [] };
    }

    const events = await ctx.db
      .query("carEvents")
      .withIndex("by_car", (q) => q.eq("carId", car._id))
      .order("desc")
      .take(20);

    return { team, car, events };
  },
});

export const createCarEventByPin = mutation({
  args: {
    pin: v.string(),
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
  },
  handler: async (ctx, args) => {
    const cleanPin = args.pin.trim();
    const teams = await ctx.db.query("installationTeams").collect();
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy kod PIN ekipy.");
    }

    const cars = await ctx.db
      .query("cars")
      .withIndex("by_team", (q) => q.eq("assignedInstallationTeamId", team._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const car = cars[0];
    if (!car) {
      throw new Error("Brak przypisanego aktywnego pojazdu dla Twojej ekipy.");
    }

    return await ctx.db.insert("carEvents", {
      carId: car._id,
      type: args.type,
      date: args.date,
      cost: args.cost,
      description: args.description,
      mileage: args.mileage,
      createdAt: Date.now(),
    });
  },
});

