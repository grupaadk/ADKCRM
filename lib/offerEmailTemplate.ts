import type { EstimateCardData, EstimateItem } from "@/components/EstimateCardView";

export type OfferEmailOptions = {
  estimate: EstimateCardData;
  subject?: string;
  introText?: string;
  salesRepName?: string;
  salesRepPhone?: string;
  salesRepEmail?: string;
  companyAddress?: string;
  /** Base URL, e.g. https://adkokna.pl */
  baseUrl?: string;
  acceptOfferUrl?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function computeSummary(items: EstimateItem[], discountPercent: number) {
  const netTotal = items.reduce((sum, i) => sum + i.qty * i.priceNet, 0);
  const discountAmount = netTotal * (discountPercent / 100);
  const netAfterDiscount = netTotal - discountAmount;
  const vatTotal = items.reduce((sum, i) => {
    const itemNet = i.qty * i.priceNet;
    const itemNetAfterDiscount = itemNet * (1 - discountPercent / 100);
    return sum + itemNetAfterDiscount * (i.vat / 100);
  }, 0);
  const grossTotal = netAfterDiscount + vatTotal;
  return { netTotal, discountAmount, netAfterDiscount, vatTotal, grossTotal };
}

const CATEGORY_LABELS: Record<string, string> = {
  service: "Usługi",
  installation: "Montaż",
  extras: "Dodatki",
};

const CATEGORY_COLORS: Record<string, string> = {
  service: "#1e3a5f",
  installation: "#0f5132",
  extras: "#4a1942",
};

// ─── HTML Builder ─────────────────────────────────────────────────────────────

export function generateOfferEmailHtml(opts: OfferEmailOptions): string {
  const { estimate, introText, salesRepName, salesRepPhone, salesRepEmail, acceptOfferUrl, companyAddress } = opts;
  const { client, items, discountPercent, title } = estimate;

  const summary = computeSummary(items, discountPercent);

  const clientName =
    client.clientType === "business" && client.companyName
      ? client.companyName
      : `${client.firstName} ${client.lastName}`;

  // Group items by category
  const grouped: Record<string, EstimateItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const categoryOrder = ["service", "installation", "extras"];

  const buildItemsRows = () => {
    let rows = "";
    for (const cat of categoryOrder) {
      const catItems = grouped[cat];
      if (!catItems || catItems.length === 0) continue;
      const label = CATEGORY_LABELS[cat] ?? cat;
      const color = CATEGORY_COLORS[cat] ?? "#1e3a5f";
      rows += `
        <tr>
          <td colspan="5" style="background:${color};padding:8px 14px;font-size:11px;font-weight:700;color:#fff;letter-spacing:1.2px;text-transform:uppercase;">${label}</td>
        </tr>`;
      catItems.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafd";
        const lineNet = item.qty * item.priceNet;
        const lineNetAfterDiscount = lineNet * (1 - discountPercent / 100);
        rows += `
        <tr style="background:${rowBg};">
          <td style="padding:10px 14px;font-size:13px;color:#1a2e44;border-bottom:1px solid #e8eef5;">
            <strong style="display:block;margin-bottom:2px;">${item.name}</strong>
            <span style="font-size:11px;color:#6b7fa3;">${item.specs}</span>
          </td>
          <td style="padding:10px 14px;text-align:center;font-size:13px;color:#1a2e44;border-bottom:1px solid #e8eef5;white-space:nowrap;">${item.qty} szt.</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;color:#1a2e44;border-bottom:1px solid #e8eef5;white-space:nowrap;">${fmt(item.priceNet)} zł</td>
          <td style="padding:10px 14px;text-align:center;font-size:13px;color:#6b7fa3;border-bottom:1px solid #e8eef5;">${item.vat}%</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#1a2e44;border-bottom:1px solid #e8eef5;white-space:nowrap;">${fmt(lineNetAfterDiscount)} zł</td>
        </tr>`;
      });
    }
    return rows;
  };

  const discountRow =
    discountPercent > 0
      ? `<tr>
          <td style="padding:10px 20px;font-size:13px;color:#6b7fa3;">Rabat (${discountPercent}%)</td>
          <td style="padding:10px 20px;text-align:right;font-size:13px;color:#dc2626;font-weight:600;">-${fmt(summary.discountAmount)} zł</td>
        </tr>`
      : "";

  const acceptBtnUrl = acceptOfferUrl ?? "#";
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const validUntilStr = validUntil.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sentDateStr = now.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const offerNumber = title.replace("Wycena #", "").replace("Wycena ", "");

  const greeting =
    client.clientType === "individual" && client.firstName
      ? `Szanowna/Szanowny Pani/Panie ${client.firstName},`
      : `Szanowni Państwo,`;

  const defaultIntro = `Dziękujemy za zainteresowanie naszą ofertą. Poniżej przesyłamy szczegółową specyfikację wraz z kalkulacją, przygotowaną specjalnie dla Państwa. Zapraszamy do zapoznania się z ofertą i prosimy o kontakt w razie pytań.`;

  const investmentAddress = [
    client.investmentStreet
      ? `${client.investmentStreet} ${client.investmentBuildingNumber ?? ""}`.trim()
      : client.street
        ? `${client.street} ${client.buildingNumber ?? ""}`.trim()
        : "",
    [
      client.investmentPostalCode ?? client.postalCode ?? "",
      client.investmentCity ?? client.city ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#eef2f7;">
  Oferta handlowa Grupy ADK — ${offerNumber} — Wartość: ${fmt(summary.grossTotal)} zł brutto
</div>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d2137 0%,#1a3a5c 50%,#0f5a9a 100%);padding:32px 36px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                    Grupa <span style="color:#4db8ff;">ADK</span>
                  </div>
                  <div style="font-size:11px;font-weight:600;color:#93c5e8;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
                    Stolarka Aluminiowa &amp; PVC
                  </div>
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 16px;">
                    <div style="font-size:10px;color:#93c5e8;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Oferta nr</div>
                    <div style="font-size:14px;color:#ffffff;font-weight:700;margin-top:3px;">${offerNumber}</div>
                    <div style="font-size:10px;color:#93c5e8;margin-top:6px;">Data: ${sentDateStr}</div>
                    <div style="font-size:10px;color:#93c5e8;">Ważna do: ${validUntilStr}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- GREETING -->
        <tr>
          <td style="padding:32px 36px 0;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e44;">${greeting}</p>
            <p style="margin:0;font-size:14px;color:#4a5e78;line-height:1.75;">${introText ? introText.replace(/\n/g, "<br/>") : defaultIntro}</p>
          </td>
        </tr>

        <!-- CLIENT DATA -->
        <tr>
          <td style="padding:20px 36px 0;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f5fb;border-radius:8px;border-left:4px solid #0f5a9a;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-size:11px;font-weight:700;color:#0f5a9a;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Dane Klienta</div>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="50%" style="vertical-align:top;font-size:13px;color:#1a2e44;padding-bottom:4px;">
                        <strong>${clientName}</strong><br/>
                        ${client.phone ? `<span style="color:#4a5e78;">Tel: ${client.phone}</span><br/>` : ""}
                        ${client.email ? `<span style="color:#4a5e78;">${client.email}</span>` : ""}
                      </td>
                      <td width="50%" style="vertical-align:top;font-size:13px;color:#4a5e78;padding-bottom:4px;">
                        ${investmentAddress ? `<strong style="color:#1a2e44;">Adres inwestycji:</strong><br/>${investmentAddress}` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ITEMS TABLE -->
        <tr>
          <td style="padding:24px 36px 0;">
            <div style="font-size:11px;font-weight:700;color:#0f5a9a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Specyfikacja Oferty</div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #dce8f5;border-radius:8px;overflow:hidden;">
              <tr style="background:#1a3a5c;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Nazwa / Specyfikacja</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#ffffff;white-space:nowrap;">Ilość</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;white-space:nowrap;">Cena netto</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#ffffff;">VAT</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;white-space:nowrap;">Razem netto</th>
              </tr>
              ${buildItemsRows()}
            </table>
          </td>
        </tr>

        <!-- SUMMARY BOX -->
        <tr>
          <td style="padding:16px 36px 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="right" style="min-width:280px;border:2px solid #0f5a9a;border-radius:8px;overflow:hidden;">
              <tr>
                <td colspan="2" style="background:#0f5a9a;padding:10px 20px;">
                  <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">Podsumowanie Wartości</div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 20px;font-size:13px;color:#4a5e78;">Wartość netto</td>
                <td style="padding:10px 20px;text-align:right;font-size:13px;color:#1a2e44;font-weight:600;">${fmt(summary.netTotal)} zł</td>
              </tr>
              ${discountRow}
              <tr>
                <td style="padding:6px 20px;font-size:13px;color:#4a5e78;">Podatek VAT</td>
                <td style="padding:6px 20px;text-align:right;font-size:13px;color:#1a2e44;">${fmt(summary.vatTotal)} zł</td>
              </tr>
              <tr style="background:#f0f5fb;">
                <td style="padding:14px 20px;font-size:15px;font-weight:800;color:#0f5a9a;border-top:2px solid #0f5a9a;">Łącznie brutto</td>
                <td style="padding:14px 20px;text-align:right;font-size:18px;font-weight:800;color:#0f5a9a;border-top:2px solid #0f5a9a;white-space:nowrap;">${fmt(summary.grossTotal)} zł</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA BUTTONS -->
        <tr>
          <td style="padding:40px 36px 0;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${acceptBtnUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f5a9a,#1a80cf);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;">
                    &#x2705;&nbsp; Akceptuję ofertę
                  </a>
                </td>
                <td>
                  <a href="#" style="display:inline-block;background:#ffffff;color:#0f5a9a;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;border:2px solid #0f5a9a;">
                    &#x1F4C4;&nbsp; Pobierz PDF
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#8a9bb8;">
              Oferta jest ważna przez 30 dni od daty wystawienia. W razie pytań prosimy o kontakt z doradcą.
            </p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr>
          <td style="padding:32px 36px 0;">
            <div style="border-top:1px solid #dce8f5;"></div>
          </td>
        </tr>

        <!-- SALES REP FOOTER -->
        <tr>
          <td style="padding:24px 36px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:13px;font-weight:700;color:#1a2e44;">${salesRepName ?? "Dział Handlowy"}</div>
                  <div style="font-size:12px;color:#4a5e78;margin-top:2px;">Doradca Handlowy · Grupa ADK</div>
                  ${salesRepPhone ? `<div style="font-size:12px;color:#4a5e78;margin-top:6px;">&#x260E; ${salesRepPhone}</div>` : ""}
                  ${salesRepEmail ? `<div style="font-size:12px;color:#0f5a9a;margin-top:2px;">&#x2709; ${salesRepEmail}</div>` : ""}
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="font-size:11px;color:#8a9bb8;text-align:right;line-height:1.6;">
                    <strong style="color:#1a2e44;font-size:12px;">Grupa ADK</strong><br/>
                    ${companyAddress ?? "ul. Przykładowa 1, 00-001 Warszawa"}<br/>
                    aluminiumadk@gmail.com
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BOTTOM BAND -->
        <tr>
          <td style="background:#0d2137;padding:14px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#5a7a99;line-height:1.6;">
              Wiadomość wygenerowana automatycznie przez system CRM Grupy ADK. Prosimy nie odpowiadać na tę wiadomość.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
