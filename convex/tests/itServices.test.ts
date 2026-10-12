import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("IT Services Management (convex/itServices.ts)", () => {
  test("creates, lists, updates and deletes an IT service with password", async () => {
    const t = convexTest(schema);

    // 1. Create a service with password
    const serviceId = await t.mutation(api.itServices.createService, {
      name: "Google Workspace",
      provider: "Google LLC",
      cost: 150,
      currency: "PLN",
      billingCycle: "monthly",
      renewalDay: 15,
      paymentMethod: "Karta firmowa",
      websiteUrl: "https://admin.google.com",
      adminEmail: "admin@grupaadk.pl",
      password: "SuperSecretPassword123!",
    });

    expect(serviceId).toBeDefined();

    // 2. Query services
    const services = await t.query(api.itServices.getServices, {});
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("Google Workspace");
    expect(services[0].cost).toBe(150);
    expect(services[0].currency).toBe("PLN");
    expect(services[0].billingCycle).toBe("monthly");
    expect(services[0].password).toBe("SuperSecretPassword123!");

    // 3. Update service (e.g. change password and cost)
    await t.mutation(api.itServices.updateService, {
      id: serviceId,
      name: "Google Workspace Business Plus",
      cost: 180,
      currency: "PLN",
      billingCycle: "monthly",
      password: "NewPassword456!",
    });

    const updatedServices = await t.query(api.itServices.getServices, {});
    expect(updatedServices[0].name).toBe("Google Workspace Business Plus");
    expect(updatedServices[0].cost).toBe(180);
    expect(updatedServices[0].password).toBe("NewPassword456!");

    // 4. Delete service
    await t.mutation(api.itServices.deleteService, { id: serviceId });
    const emptyServices = await t.query(api.itServices.getServices, {});
    expect(emptyServices).toHaveLength(0);
  });

  test("creates a service with specific renewalDate (e.g. domain)", async () => {
    const t = convexTest(schema);

    const domainServiceId = await t.mutation(api.itServices.createService, {
      name: "Domena grupaadk.pl",
      provider: "Cyberfolks S.A.",
      cost: 140,
      currency: "PLN",
      billingCycle: "yearly",
      renewalDate: "2027-05-18",
      paymentMethod: "Przelew proforma",
      websiteUrl: "https://cyberfolks.pl",
    });

    expect(domainServiceId).toBeDefined();

    const services = await t.query(api.itServices.getServices, {});
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("Domena grupaadk.pl");
    expect(services[0].renewalDate).toBe("2027-05-18");
    expect(services[0].billingCycle).toBe("yearly");
  });
});
