import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type TestRuntime = ReturnType<typeof convexTest>;

async function createTestUser(
  t: TestRuntime,
  email: string,
  role: "admin" | "sales" | "montaz" = "sales",
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email,
      displayName: email.split("@")[0],
      role,
      isActive: true,
    });
  });
  return { userId, asUser: t.withIdentity({ subject: userId }) };
}

describe("In-App Notification System", () => {
  test("generates notifications for active admin and sales users when a new opportunity is created", async () => {
    const t = convexTest(schema);

    const user1 = await createTestUser(t, "sales1@example.pl", "sales");
    const user2 = await createTestUser(t, "sales2@example.pl", "sales");
    const admin = await createTestUser(t, "admin@example.pl", "admin");
    const montaz = await createTestUser(t, "montaz@example.pl", "montaz");

    // user1 creates a manual opportunity
    const oppId = await user1.asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Marek",
      lastName: "Nowak",
      email: "marek@example.pl",
      phone: "+48 501 222 333",
      city: "Kraków",
      services: ["Okna", "Drzwi"],
    });

    expect(oppId).toBeDefined();

    // user1 is the creator, and user1 should also receive a notification
    const user1Notifications = await user1.asUser.query(api.notifications.list, {});
    expect(user1Notifications.length).toBe(1);
    expect(user1Notifications[0].title).toBe("Nowa szansa: Marek Nowak");

    // user2 (sales) should receive a notification
    const user2Notifications = await user2.asUser.query(api.notifications.list, {});
    expect(user2Notifications.length).toBe(1);
    expect(user2Notifications[0].title).toBe("Nowa szansa: Marek Nowak");
    expect(user2Notifications[0].message).toContain("Kraków");
    expect(user2Notifications[0].message).toContain("Okna, Drzwi");
    expect(user2Notifications[0].link).toBe(`/admin/szansa/${oppId}`);
    expect(user2Notifications[0].read).toBe(false);

    // admin should also receive a notification
    const adminNotifications = await admin.asUser.query(api.notifications.list, {});
    expect(adminNotifications.length).toBe(1);

    // montaz should NOT receive sales opportunity notifications
    const montazNotifications = await montaz.asUser.query(api.notifications.list, {});
    expect(montazNotifications.length).toBe(0);
  });

  test("manages unread count, markAsRead, and markAllAsRead correctly", async () => {
    const t = convexTest(schema);

    const user = await createTestUser(t, "user@example.pl", "sales");

    // Create 2 opportunities from external/jotform handler (no creator specified)
    await user.asUser.mutation(api.salesOpportunities.createSalesOpportunity, {
      firstName: "Anna",
      lastName: "Kowalska",
      city: "Gdańsk",
      services: ["Rolety"],
    });
    await user.asUser.mutation(api.salesOpportunities.createSalesOpportunity, {
      firstName: "Piotr",
      lastName: "Zieliński",
      city: "Gdynia",
      services: ["Brama"],
    });

    // Check unread count
    let unreadCount = await user.asUser.query(api.notifications.getUnreadCount, {});
    expect(unreadCount).toBe(2);

    const list = await user.asUser.query(api.notifications.list, {});
    expect(list.length).toBe(2);

    // Mark the first one as read
    await user.asUser.mutation(api.notifications.markAsRead, {
      notificationId: list[0]._id,
    });

    unreadCount = await user.asUser.query(api.notifications.getUnreadCount, {});
    expect(unreadCount).toBe(1);

    // Mark all as read
    await user.asUser.mutation(api.notifications.markAllAsRead, {});
    unreadCount = await user.asUser.query(api.notifications.getUnreadCount, {});
    expect(unreadCount).toBe(0);
  });

  test("allows deleting notifications with proper ownership check", async () => {
    const t = convexTest(schema);

    const user1 = await createTestUser(t, "u1@example.pl", "sales");
    const user2 = await createTestUser(t, "u2@example.pl", "sales");

    await user1.asUser.mutation(api.salesOpportunities.createSalesOpportunity, {
      firstName: "Tomasz",
      lastName: "Wójcik",
    });

    const user1List = await user1.asUser.query(api.notifications.list, {});
    const user2List = await user2.asUser.query(api.notifications.list, {});

    expect(user1List.length).toBe(1);
    expect(user2List.length).toBe(1);

    // user2 cannot delete user1's notification
    await expect(
      user2.asUser.mutation(api.notifications.deleteNotification, {
        notificationId: user1List[0]._id,
      }),
    ).rejects.toThrow("Brak uprawnień do usunięcia tego powiadomienia.");

    // user1 can delete their own notification
    await user1.asUser.mutation(api.notifications.deleteNotification, {
      notificationId: user1List[0]._id,
    });

    const refreshedList = await user1.asUser.query(api.notifications.list, {});
    expect(refreshedList.length).toBe(0);

    // user2 still has their notification intact
    const user2Refreshed = await user2.asUser.query(api.notifications.list, {});
    expect(user2Refreshed.length).toBe(1);
  });

  test("generates order_message notification on Exalco webhook note and clears it when supplier notes are marked read", async () => {
    const t = convexTest(schema);

    const admin = await createTestUser(t, "admin_exalco@example.pl", "admin");
    const sales = await createTestUser(t, "sales_exalco@example.pl", "sales");

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Exalco",
        isActive: true,
        createdBy: "test",
      });
    });

    const clientId = await admin.asUser.mutation(api.clients.create, {
      firstName: "Kamil",
      lastName: "Nowicki",
    });

    const orderId = await admin.asUser.mutation(api.orders.create, { clientId });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Okna ALU",
            supplierId,
            externalOrderNumber: "EX-NOTIF-001",
          },
        ],
      });
    });

    // Receive note from Exalco webhook
    await t.mutation(api.orders.receiveNoteFromExalcoWebhook, {
      orderIdOrNumber: "EX-NOTIF-001",
      noteText: "Towar został spakowany i oczekuje na odbiór.",
      authorName: "Magazyn Exalco",
    });

    // Check notifications for admin and sales
    const adminNotifs = await admin.asUser.query(api.notifications.list, {});
    const salesNotifs = await sales.asUser.query(api.notifications.list, {});

    expect(adminNotifs.length).toBe(1);
    expect(adminNotifs[0].type).toBe("order_message");
    expect(adminNotifs[0].title).toContain("Exalco");
    expect(adminNotifs[0].message).toContain("Towar został spakowany");
    expect(adminNotifs[0].link).toContain(`/admin/klient/${clientId}/zlecenie/${orderId}?tab=zamowienia&deliveryIndex=0`);
    expect(adminNotifs[0].read).toBe(false);

    expect(salesNotifs.length).toBe(1);
    expect(salesNotifs[0].type).toBe("order_message");

    // Admin opens delivery -> marks notes as read
    await admin.asUser.mutation(api.orders.markSupplierNotesAsRead, {
      orderId,
      deliveryIndex: 0,
    });

    // Admin's notification should be marked as read
    const adminNotifsAfter = await admin.asUser.query(api.notifications.list, {});
    expect(adminNotifsAfter[0].read).toBe(true);

    const adminUnread = await admin.asUser.query(api.notifications.getUnreadCount, {});
    expect(adminUnread).toBe(0);
  });

  test("notifies other users when ADK user adds an internal note (excludes author)", async () => {
    const t = convexTest(schema);

    const author = await createTestUser(t, "author@example.pl", "sales");
    const colleague = await createTestUser(t, "colleague@example.pl", "sales");

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Aliplast",
        isActive: true,
        createdBy: "test",
      });
    });

    const clientId = await author.asUser.mutation(api.clients.create, {
      firstName: "Ewa",
      lastName: "Dąbrowska",
    });

    const orderId = await author.asUser.mutation(api.orders.create, { clientId });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Konstrukcje",
            supplierId,
          },
        ],
      });
    });

    // Author adds note
    await author.asUser.mutation(api.orders.addInternalSupplierNote, {
      orderId,
      deliveryIndex: 0,
      noteText: "Wysłałem zapytanie o rabat do opiekuna.",
    });

    // Author should NOT receive a notification (excluded)
    const authorNotifs = await author.asUser.query(api.notifications.list, {});
    expect(authorNotifs.length).toBe(0);

    // Colleague SHOULD receive a notification
    const colleagueNotifs = await colleague.asUser.query(api.notifications.list, {});
    expect(colleagueNotifs.length).toBe(1);
    expect(colleagueNotifs[0].type).toBe("order_message");
    expect(colleagueNotifs[0].message).toContain("Wysłałem zapytanie o rabat");
  });
});
