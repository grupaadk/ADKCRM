/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("terracePricing", () => {
  test("seedDefaultTerracePrices inserts standard prices", async () => {
    const t = convexTest(schema, modules);
    const res = await t.mutation(api.terracePricing.seedDefaultTerracePrices, { overwrite: true });
    expect(res.seeded).toBe(60);

    const polyList = await t.query(api.terracePricing.listTerracePrices, { material: "polycarbonate" });
    expect(polyList.length).toBe(30);

    const glassList = await t.query(api.terracePricing.listTerracePrices, { material: "glass" });
    expect(glassList.length).toBe(30);

    // Sprawdź przykładowy wymiar 300 x 306 cm
    const item = await t.query(api.terracePricing.getTerracePrice, {
      material: "polycarbonate",
      widthCm: 300,
      lengthCm: 306,
    });
    expect(item).not.toBeNull();
    expect(item?.priceGross).toBe(4130);
    expect(item?.priceNet).toBe(3358);
  });

  test("upsertTerracePrice updates existing price", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.terracePricing.seedDefaultTerracePrices, { overwrite: true });

    await t.mutation(api.terracePricing.upsertTerracePrice, {
      material: "polycarbonate",
      widthCm: 300,
      lengthCm: 306,
      priceGross: 4500,
      priceNet: 3650,
    });

    const updated = await t.query(api.terracePricing.getTerracePrice, {
      material: "polycarbonate",
      widthCm: 300,
      lengthCm: 306,
    });
    expect(updated?.priceGross).toBe(4500);
    expect(updated?.priceNet).toBe(3650);
  });
});
