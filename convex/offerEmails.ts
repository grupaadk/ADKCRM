import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Internal mutation: record offer sent event on opportunity ────────────────

export const recordOfferSent = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    emailSubject: v.string(),
    emailTo: v.string(),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    // Zmień stage na inquiry (oferta wysłana)
    await ctx.db.patch(args.opportunityId, {
      stage: "inquiry",
      stageChangedAt: args.sentAt,
      offerSentAt: args.sentAt,
    });

    // Jeśli jest powiązany klient — zapisz w clientEvents
    if (opp.clientId) {
      await ctx.db.insert("clientEvents", {
        clientId: opp.clientId,
        type: "offer_sent",
        details: {
          subject: args.emailSubject,
          to: args.emailTo,
          sentAt: args.sentAt,
          opportunityId: args.opportunityId,
        },
        performedBy: "system",
      });
    }
  },
});

// ─── Internal mutation: create follow-up calendar reminder ───────────────────

export const createFollowUpReminder = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    clientName: v.string(),
    offerTitle: v.string(),
    followUpDays: v.number(),
    assignedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const followUpTs =
      Date.now() + args.followUpDays * 24 * 60 * 60 * 1000;

    // Poszukaj (lub utwórz) typ zdarzenia "Follow-up"
    const existing = await ctx.db.query("calendarEventTypes").collect();
    let followUpTypeId: Id<"calendarEventTypes"> | undefined = existing.find(
      (t) => t.name.toLowerCase().includes("follow-up"),
    )?._id;

    if (!followUpTypeId) {
      followUpTypeId = await ctx.db.insert("calendarEventTypes", {
        name: "Follow-up",
        color: "#f59e0b",
        isPrivate: false,
        defaultTimeMode: "timed",
        createdAt: Date.now(),
      });
    }

    // Pobierz pierwsze konto użytkownika jako createdBy
    const fallbackUser = await ctx.db.query("users").first();
    if (!fallbackUser) return;

    const createdBy: Id<"users"> =
      (args.assignedUserIds && args.assignedUserIds.length > 0)
        ? args.assignedUserIds[0]
        : fallbackUser._id;

    await ctx.db.insert("calendarEvents", {
      eventTypeId: followUpTypeId,
      title: `Follow-up: ${args.offerTitle} — ${args.clientName}`,
      description: `Przypomnienie o kontakcie z klientem po wysłaniu oferty.`,
      startDate: followUpTs,
      isAllDay: true,
      isPrivate: false,
      assignedUserIds: args.assignedUserIds ?? [],
      createdBy,
      createdAt: Date.now(),
    });
  },
});

// ─── Public action: send offer email ─────────────────────────────────────────

export const sendOfferEmail = action({
  args: {
    opportunityId: v.optional(v.id("pendingJotformSubmissions")),
    // E-mail content
    to: v.string(),
    cc: v.optional(v.string()),
    subject: v.string(),
    htmlBody: v.string(),
    // Follow-up
    followUpDays: v.optional(v.number()),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    // Metadata for recording
    offerTitle: v.string(),
    clientName: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId: string }> => {
    const ccAddress = args.cc ?? "aluminiumadk@gmail.com";

    // Send via Gmail action (Cc header is now supported in gmail.ts)
    const result: { id: string; threadId: string } = await ctx.runAction(api.gmail.sendEmail, {
      to: args.to,
      subject: args.subject,
      body: args.htmlBody,
      cc: ccAddress,
    });

    const sentAt = Date.now();

    // Record in CRM
    if (args.opportunityId) {
      await ctx.runMutation(internal.offerEmails.recordOfferSent, {
        opportunityId: args.opportunityId,
        emailSubject: args.subject,
        emailTo: args.to,
        sentAt,
      });

      // Create follow-up reminder if requested
      if (args.followUpDays && args.followUpDays > 0) {
        await ctx.runMutation(internal.offerEmails.createFollowUpReminder, {
          opportunityId: args.opportunityId,
          clientName: args.clientName,
          offerTitle: args.offerTitle,
          followUpDays: args.followUpDays,
          assignedUserIds: args.assignedUserIds,
        });
      }
    }

    return { success: true, messageId: result.id };
  },
});
