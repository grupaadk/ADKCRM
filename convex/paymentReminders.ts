import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

const BANK_ACCOUNT = "77 1240 2702 1111 0011 0284 4073";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (amount == null) return "—";
  return `${amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? "PLN"}`;
}

function buildEmail(params: {
  invoiceNumber: string;
  issueDate: string;
  paymentTo: string;
  grossAmount: string;
}): { subject: string; body: string; previewText: string } {
  const { invoiceNumber, issueDate, paymentTo, grossAmount } = params;

  const salutation = `Szanowni Państwo,`;

  const subject = `Przypomnienie o płatności – faktura ${invoiceNumber}`;

  const previewText = [
    salutation,
    "",
    "uprzejmie przypominamy, że w naszym systemie nie odnotowaliśmy jeszcze płatności za poniższą fakturę:",
    "",
    `  • Numer faktury: ${invoiceNumber}`,
    `  • Data wystawienia: ${issueDate}`,
    `  • Termin płatności: ${paymentTo}`,
    `  • Kwota do zapłaty: ${grossAmount}`,
    `  • Numer rachunku: ${BANK_ACCOUNT}`,
    "",
    "Jeżeli przelew został już zrealizowany, proszę potraktować niniejszą wiadomość jako bezprzedmiotową.",
    "W przeciwnym razie bardzo prosimy o uregulowanie należności.",
    "",
    "W razie jakichkolwiek pytań dotyczących faktury pozostajemy do dyspozycji.",
    "",
    "Z poważaniem,",
    "Grupa ADK",
  ].join("\n");

  const htmlLines = [
    escapeHtml(salutation),
    "<br>",
    "uprzejmie przypominamy, że w naszym systemie nie odnotowaliśmy jeszcze płatności za poniższą fakturę:",
    "<br>",
    `&nbsp;&nbsp;&bull;&nbsp;Numer faktury: <strong>${escapeHtml(invoiceNumber)}</strong>`,
    `&nbsp;&nbsp;&bull;&nbsp;Data wystawienia: ${escapeHtml(issueDate)}`,
    `&nbsp;&nbsp;&bull;&nbsp;Termin płatności: ${escapeHtml(paymentTo)}`,
    `&nbsp;&nbsp;&bull;&nbsp;Kwota do zapłaty: <strong>${escapeHtml(grossAmount)}</strong>`,
    `&nbsp;&nbsp;&bull;&nbsp;Numer rachunku: ${BANK_ACCOUNT}`,
    "<br>",
    "Jeżeli przelew został już zrealizowany, proszę potraktować niniejszą wiadomość jako bezprzedmiotową.",
    "W przeciwnym razie bardzo prosimy o uregulowanie należności.",
    "<br>",
    "W razie jakichkolwiek pytań dotyczących faktury pozostajemy do dyspozycji.",
    "<br>",
    "Z poważaniem,<br>Grupa ADK",
  ];
  const body = htmlLines.join("<br>\n");

  return { subject, body, previewText };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

export const getDataForReminder = internalQuery({
  args: { invoiceId: v.id("fakturowniaInvoicesCache") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    const order = invoice.orderId ? await ctx.db.get(invoice.orderId) : null;
    const client = order ? await ctx.db.get(order.clientId) : null;
    return { invoice, order, client };
  },
});

export const logReminder = internalMutation({
  args: {
    invoiceId: v.id("fakturowniaInvoicesCache"),
    orderId: v.optional(v.id("orders")),
    clientId: v.id("clients"),
    recipientEmail: v.string(),
    sentBy: v.string(),
    invoiceNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("paymentReminders", {
      ...args,
      sentAt: Date.now(),
    });
  },
});

// ─── Public queries ───────────────────────────────────────────────────────────

export const previewReminder = query({
  args: { invoiceId: v.id("fakturowniaInvoicesCache") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    const order = invoice.orderId ? await ctx.db.get(invoice.orderId) : null;
    const client = order ? await ctx.db.get(order.clientId) : null;

    const invoiceNumber = invoice.number ?? invoice.remoteId;

    if (!client) {
      return { hasClient: false, hasEmail: false, invoiceNumber, to: null, subject: null, previewText: null };
    }

    const { subject, previewText } = buildEmail({
      invoiceNumber,
      issueDate: formatDate(invoice.issueDate),
      paymentTo: formatDate(invoice.paymentTo),
      grossAmount: formatAmount(invoice.grossAmount, invoice.currency),
    });

    return {
      hasClient: true,
      hasEmail: !!client.email,
      invoiceNumber,
      to: client.email ?? null,
      subject,
      previewText,
    };
  },
});

export const listByInvoice = query({
  args: { invoiceId: v.id("fakturowniaInvoicesCache") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentReminders")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .collect();
  },
});

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentReminders")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .collect();
  },
});

// ─── Public action ────────────────────────────────────────────────────────────

export const sendReminder = action({
  args: { invoiceId: v.id("fakturowniaInvoicesCache") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Brak autoryzacji");
    const user = (await ctx.runQuery(internal.users._internalGetUser, {
      userId: currentUserId,
    })) as Doc<"users"> | null;
    if (!user || user.isActive !== true) throw new Error("Brak autoryzacji");
    const sentBy = user.email ?? user._id;

    const data = await ctx.runQuery(internal.paymentReminders.getDataForReminder, {
      invoiceId: args.invoiceId,
    });

    if (!data) throw new Error("Faktura nie znaleziona");
    const { invoice, client } = data;

    if (!client) throw new Error("Faktura nie jest przypisana do żadnego klienta");
    if (!client.email) throw new Error("Klient nie ma przypisanego adresu email");

    const { subject, body } = buildEmail({
      invoiceNumber: invoice.number ?? invoice.remoteId,
      issueDate: formatDate(invoice.issueDate),
      paymentTo: formatDate(invoice.paymentTo),
      grossAmount: formatAmount(invoice.grossAmount, invoice.currency),
    });

    await ctx.runAction(api.gmail.sendEmail, { to: client.email, subject, body });

    await ctx.runMutation(internal.paymentReminders.logReminder, {
      invoiceId: args.invoiceId,
      orderId: invoice.orderId,
      clientId: client._id,
      recipientEmail: client.email,
      sentBy,
      invoiceNumber: invoice.number,
    });
  },
});
