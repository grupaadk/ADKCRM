import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  calculateGlassWallItem,
  calculateGlassSegments,
  GLASS_WALL_THRESHOLDS,
  DEFAULT_GLASS_WALL_RATES,
} from "./lib/glassWallCalculator";

/**
 * Zwraca cennik progowy i stawki kalkulatora ścianek szklanych
 */
export const getPricingMatrix = query({
  args: {},
  handler: async () => {
    return {
      thresholds: GLASS_WALL_THRESHOLDS,
      defaultRates: DEFAULT_GLASS_WALL_RATES,
    };
  },
});

/**
 * Wylicza koszt, cenę klienta i montaż dla pojedynczej ścianki szklanej lub trójkąta
 */
export const calculateWall = query({
  args: {
    wallType: v.union(
      v.literal("front"),
      v.literal("side"),
      v.literal("triangle"),
      v.literal("foundation"),
      v.literal("lamella")
    ),
    widthMm: v.number(),
    heightMm: v.number(),
    quantity: v.optional(v.number()),
    variant: v.optional(v.union(v.literal("standard"), v.literal("nonstandard"))),
    includeAssembly: v.optional(v.boolean()),
    customMarkup: v.optional(v.number()),
    customGlassCostPerM2: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return calculateGlassWallItem({
      wallType: args.wallType,
      widthMm: args.widthMm,
      heightMm: args.heightMm,
      quantity: args.quantity,
      variant: args.variant,
      includeAssembly: args.includeAssembly,
      customMarkup: args.customMarkup,
      customGlassCostPerM2: args.customGlassCostPerM2,
    });
  },
});

/**
 * Wylicza wymiary i podział szyb z zachodzeniem Z dla CAD
 */
export const getGlassSegments = query({
  args: {
    widthMm: v.number(),
    heightMm: v.number(),
    panesCount: v.optional(v.number()),
    overlapMm: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return calculateGlassSegments(
      args.widthMm,
      args.heightMm,
      args.panesCount,
      args.overlapMm
    );
  },
});
