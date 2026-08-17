import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const addAlcoDeliveryOrder = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    // Znajdź dostawcę ALCO
    const allSuppliers = await ctx.db.query("suppliers").collect();
    const alcoSupplier = allSuppliers.find((s) => s.name.toUpperCase().includes("ALCO"));
    if (!alcoSupplier) throw new Error("Nie znaleziono dostawcy ALCO.");

    // Upewnij się, że dostawca ALCO ma ustawiony poprawny endpoint API oraz włączoną integrację
    const apiEndpoint = "https://woozy-gnat-639.eu-west-1.convex.site/api/partner/orders";
    const apiKey = "pk_live_df801aab1453b4b5e09e4eae30409aad043050d31030dc50";
    await ctx.db.patch(alcoSupplier._id, {
      apiEndpoint,
      apiKey,
      isApiEnabled: true,
    });

    const currentDeliveries = order.serviceDeliveries ?? [];
    const newEntry = {
      serviceName: (order.services && order.services[0]) ? order.services[0] : "Okna ALU",
      supplierId: alcoSupplier._id,
      orderDate: Date.now(),
      netAmount: 12500,
      notes: "Testowe zamówienie automatyczne z integracji ADK -> CRM Exalco",
    };

    const targetIndex = currentDeliveries.length;
    currentDeliveries.push(newEntry);

    await ctx.db.patch(args.orderId, { serviceDeliveries: currentDeliveries });

    return {
      orderId: args.orderId,
      deliveryIndex: targetIndex,
      supplierId: alcoSupplier._id,
      supplierName: alcoSupplier.name,
      apiEndpoint: alcoSupplier.apiEndpoint,
      isApiEnabled: alcoSupplier.isApiEnabled,
    };
  },
});
