/**
 * Utility do generowania czystego, inżynierskiego wektorowego SVG oraz konwersji do PNG
 * dla konstrukcji CAD do wstawienia do ofert PDF (Google Slides / Docs).
 */

import { CadConstructionItem, CadSegment } from "./CadCanvas";

/**
 * Generuje w pełni samodzielny kod SVG ze szkicem technicznym CAD danej konstrukcji.
 */
export function renderCadConstructionSvg(item: CadConstructionItem): string {
  const width = Math.max(item.widthMm || 2880, 300);
  const height = Math.max(item.heightMm || 2300, 200);
  const panes = Math.max(item.panesCount || 3, 1);
  const fill = item.fillType || "HART 10";
  const color = item.color || "RAL 7016MAT";

  const isTriangle =
    (item.name || "").toLowerCase().includes("trójką") ||
    Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką")) ||
    Boolean(
      item.systemName &&
        (item.systemName.toLowerCase().includes("krokiew") ||
          item.systemName.toLowerCase().includes("profil h"))
    );

  const isTriangleRight =
    isTriangle &&
    ((item.name || "").toLowerCase().includes("praw") ||
      Boolean(item.shortName && item.shortName.toLowerCase().includes("praw")));

  const paneWidth = Math.round(width / panes);
  const segments: CadSegment[] =
    item.segments && item.segments.length === panes
      ? item.segments
      : Array.from({ length: panes }).map((_, i) => ({
          widthMm: i === panes - 1 ? width - paneWidth * (panes - 1) : paneWidth,
          heightMm: height - 103,
          fill,
          weightKg: Math.round((width / panes) * height * 0.000001 * 25 * 10) / 10,
          profileTop: `5448 ${color}`,
          profileBottom: `5450 ${color}`,
          profileLeft: `5450 ${color}`,
          profileRight: `5450 ${color}`,
        }));

  // Marginesy dla linii wymiarowych
  const padLeft = 180;
  const padRight = 180;
  const padTop = 180;
  const padBottom = 160;

  const originX = padLeft;
  const originY = padTop;

  const viewBoxWidth = width + padLeft + padRight;
  const viewBoxHeight = height + padTop + padBottom;

  const frameThickness = 50;

  // Geometria trójkąta
  const tBot = 45;
  const tKrok = 50;
  const tLeft = 45;
  const tSub = 30;

  const yFloor = originY + height;
  const yProfTop = yFloor - tBot;

  const yKrokLeftTop = isTriangleRight ? Math.max(originY + 10, yProfTop - tKrok) : originY;
  const yKrokLeftBot = isTriangleRight ? yProfTop : originY + tKrok;
  const yKrokRightBot = isTriangleRight ? originY + tKrok : yProfTop;
  const yKrokRightTop = isTriangleRight ? originY : Math.max(originY + 10, yProfTop - tKrok);

  const yInnerTop = (isTriangleRight ? yKrokRightBot : yKrokLeftBot) + tSub;
  const yInnerBot = yProfTop;
  const xInnerLeft = originX + (isTriangleRight ? 0 : tLeft);
  const xInnerRight = originX + width - (isTriangleRight ? tLeft : 0);

  const mInner = Math.max(0.001, (yInnerBot - yInnerTop) / Math.max(1, xInnerRight - xInnerLeft));
  const gMargin = 14;
  const yGlassBot = yInnerBot - gMargin;
  const yGlassTop = yInnerTop + gMargin;

  const xGlassLeft = isTriangleRight
    ? Math.round(Math.max(originX + 40, (originX + width - tLeft - gMargin) - (yGlassBot - yGlassTop) / mInner))
    : xInnerLeft + gMargin;
  const xGlassRight = isTriangleRight
    ? originX + width - tLeft - gMargin
    : Math.round(
        Math.min(
          originX + width - 40,
          Math.max(xInnerLeft + gMargin + 50, xInnerLeft + (yGlassBot - gMargin - yInnerTop) / mInner)
        )
      );

  let innerDrawing = "";

  if (isTriangle) {
    innerDrawing = `
      <!-- Czerwona linia obrysu zewnętrznego -->
      <polygon points="${originX - 2},${yKrokLeftTop - 2} ${originX + width + 2},${yKrokRightTop - 2} ${originX + width + 2},${yFloor + 2} ${originX - 2},${yFloor + 2}" fill="none" stroke="#dc2626" stroke-width="2.5" />
      
      <!-- Profil H dolny -->
      <rect x="${originX}" y="${yProfTop}" width="${width}" height="${tBot}" fill="#29323d" stroke="#1e242b" stroke-width="2" />
      <text x="${originX + width / 2}" y="${yProfTop + tBot / 2 + 7}" fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle" letter-spacing="4px">PROFIL H</text>
      
      <!-- Pionowy słupek przyścienny -->
      <rect x="${isTriangleRight ? originX + width - tLeft : originX}" y="${isTriangleRight ? yKrokRightBot : yKrokLeftBot}" width="${tLeft}" height="${yProfTop - (isTriangleRight ? yKrokRightBot : yKrokLeftBot)}" fill="#29323d" stroke="#1e242b" stroke-width="2" />
      
      <!-- Belka krokwi skośna -->
      <polygon points="${originX},${yKrokLeftTop} ${originX + width},${yKrokRightTop} ${originX + width},${yKrokRightBot} ${originX},${yKrokLeftBot}" fill="#29323d" stroke="#1e242b" stroke-width="2" />
      <polygon points="${isTriangleRight ? `${originX},${yKrokLeftBot} ${originX + width},${yKrokRightBot} ${originX + width - tLeft},${yInnerTop}` : `${originX},${yKrokLeftBot} ${originX + width},${yKrokRightBot} ${originX + tLeft},${yInnerTop}`}" fill="#29323d" stroke="#1e242b" stroke-width="1.5" />
      
      <!-- Szkło -->
      <polygon points="${isTriangleRight ? `${xGlassRight},${yGlassTop} ${xGlassRight},${yGlassBot} ${xGlassLeft},${yGlassBot}` : `${xGlassLeft},${yGlassTop} ${xGlassRight},${yGlassBot} ${xGlassLeft},${yGlassBot}`}" fill="#ffffff" stroke="#38bdf8" stroke-width="2" />
      <text x="${originX + width * (isTriangleRight ? 0.65 : 0.35)}" y="${yGlassBot - 35}" fill="#0b1220" font-size="38" font-weight="900" text-anchor="middle">${fill}</text>
    `;
  } else {
    const openingW = width - frameThickness * 2;
    const openingH = height - frameThickness * 2;
    const segW = openingW / panes;

    let panesSvg = "";
    for (let idx = 0; idx < panes; idx++) {
      const segX = originX + frameThickness + idx * segW;
      const segY = originY + frameThickness;
      const centerX = segX + segW / 2;

      panesSvg += `
        <rect x="${segX + 2}" y="${segY + 2}" width="${segW - 4}" height="${openingH - 4}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
        ${idx > 0 ? `<line x1="${segX}" y1="${segY}" x2="${segX}" y2="${segY + openingH}" stroke="#dc2626" stroke-width="2" />` : ""}
        <line x1="${segX + 24}" y1="${segY + openingH - 50}" x2="${segX + segW - 24}" y2="${segY + 50}" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.25" />
        <text x="${centerX}" y="${segY + 64}" fill="#0b1220" font-size="${Math.min(42, Math.max(22, Math.round(segW * 0.12)))}" font-weight="900" text-anchor="middle">Szkło ${Math.round(segW - 10)} × ${Math.round(openingH - 12)}</text>
        <text x="${centerX}" y="${segY + openingH / 2}" fill="#0b1220" font-size="${Math.min(36, Math.max(18, Math.round(segW * 0.1)))}" font-weight="900" text-anchor="middle">${fill}</text>
      `;
    }

    innerDrawing = `
      <!-- Czerwona linia obrysu zewnętrznego -->
      <rect x="${originX - 2}" y="${originY - 2}" width="${width + 4}" height="${height + 4}" fill="none" stroke="#dc2626" stroke-width="2" />
      
      <!-- Ościeżnica / Rama główna -->
      <rect x="${originX}" y="${originY}" width="${width}" height="${height}" fill="#29323d" stroke="#1e242b" stroke-width="1.5" />
      
      <!-- Wnętrze ramy (światło) -->
      <rect x="${originX + frameThickness}" y="${originY + frameThickness}" width="${openingW}" height="${openingH}" fill="#ffffff" stroke="#1e242b" stroke-width="1.5" />
      
      <!-- Narożne cięcia 45° -->
      <line x1="${originX}" y1="${originY}" x2="${originX + frameThickness}" y2="${originY + frameThickness}" stroke="#475569" stroke-width="1.5" />
      <line x1="${originX + width}" y1="${originY}" x2="${originX + width - frameThickness}" y2="${originY + frameThickness}" stroke="#475569" stroke-width="1.5" />
      <line x1="${originX}" y1="${originY + height}" x2="${originX + frameThickness}" y2="${originY + height - frameThickness}" stroke="#475569" stroke-width="1.5" />
      <line x1="${originX + width}" y1="${originY + height}" x2="${originX + width - frameThickness}" y2="${originY + height - frameThickness}" stroke="#475569" stroke-width="1.5" />
      
      <!-- Skrzydła / Kwatery -->
      ${panesSvg}
    `;
  }

  // Linie wymiarowe
  let dimensionsSvg = "";
  if (isTriangle) {
    // Wymiar B na dole
    dimensionsSvg += `
      <line x1="${originX}" y1="${originY + height + 5}" x2="${originX}" y2="${originY + height + 85}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX + width}" y1="${originY + height + 5}" x2="${originX + width}" y2="${originY + height + 85}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX}" y1="${originY + height + 60}" x2="${originX + width}" y2="${originY + height + 60}" stroke="#0b1220" stroke-width="3" marker-start="url(#cadArrowStart)" marker-end="url(#cadArrowEnd)" />
      <rect x="${originX + width / 2 - 140}" y="${originY + height + 70}" width="280" height="52" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      <text x="${originX + width / 2}" y="${originY + height + 108}" fill="#0b1220" font-size="38" font-weight="900" text-anchor="middle">B = ${width}</text>

      <!-- Wymiar H -->
      <line x1="${isTriangleRight ? originX + width + 5 : originX - 5}" y1="${originY}" x2="${isTriangleRight ? originX + width + 80 : originX - 80}" y2="${originY}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${isTriangleRight ? originX + width + 5 : originX - 5}" y1="${originY + height}" x2="${isTriangleRight ? originX + width + 80 : originX - 80}" y2="${originY + height}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${isTriangleRight ? originX + width + 60 : originX - 60}" y1="${originY}" x2="${isTriangleRight ? originX + width + 60 : originX - 60}" y2="${originY + height}" stroke="#0b1220" stroke-width="3" marker-start="url(#cadArrowStart)" marker-end="url(#cadArrowEnd)" />
      <g transform="${isTriangleRight ? `translate(${originX + width + 96}, ${originY + height / 2}) rotate(90)` : `translate(${originX - 96}, ${originY + height / 2}) rotate(-90)`}">
        <rect x="-140" y="-36" width="280" height="52" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
        <text x="0" y="4" fill="#0b1220" font-size="38" font-weight="900" text-anchor="middle">H = ${height}</text>
      </g>
    `;
  } else {
    // Wymiary kwater u góry
    let segmentsDimSvg = "";
    for (let idx = 0; idx < panes; idx++) {
      const segStartX = originX + (idx * width) / panes;
      const segEndX = originX + ((idx + 1) * width) / panes;
      const dimY = originY - 60;
      const segCenterX = (segStartX + segEndX) / 2;
      const segWVal = segments[idx]?.widthMm || Math.round(width / panes);

      segmentsDimSvg += `
        <line x1="${segStartX}" y1="${originY - 5}" x2="${segStartX}" y2="${dimY - 14}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
        <line x1="${segEndX}" y1="${originY - 5}" x2="${segEndX}" y2="${dimY - 14}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
        <line x1="${segStartX}" y1="${dimY}" x2="${segEndX}" y2="${dimY}" stroke="#0b1220" stroke-width="3" marker-start="url(#cadArrowStart)" marker-end="url(#cadArrowEnd)" />
        <rect x="${segCenterX - 90}" y="${dimY - 48}" width="180" height="42" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
        <text x="${segCenterX}" y="${dimY - 16}" fill="#0b1220" font-size="${Math.min(34, Math.max(20, Math.round(width / panes * 0.1)))}" font-weight="900" text-anchor="middle">${segWVal}</text>
      `;
    }

    dimensionsSvg += `
      ${segmentsDimSvg}
      <!-- Wymiar całkowity B na dole -->
      <line x1="${originX}" y1="${originY + height + 5}" x2="${originX}" y2="${originY + height + 90}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX + width}" y1="${originY + height + 5}" x2="${originX + width}" y2="${originY + height + 90}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX}" y1="${originY + height + 60}" x2="${originX + width}" y2="${originY + height + 60}" stroke="#0b1220" stroke-width="3" marker-start="url(#cadArrowStart)" marker-end="url(#cadArrowEnd)" />
      <rect x="${originX + width / 2 - 140}" y="${originY + height + 70}" width="280" height="52" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      <text x="${originX + width / 2}" y="${originY + height + 108}" fill="#0b1220" font-size="38" font-weight="900" text-anchor="middle">B = ${width}</text>

      <!-- Wymiar całkowity H z lewej -->
      <line x1="${originX - 5}" y1="${originY}" x2="${originX - 90}" y2="${originY}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX - 5}" y1="${originY + height}" x2="${originX - 90}" y2="${originY + height}" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${originX - 60}" y1="${originY}" x2="${originX - 60}" y2="${originY + height}" stroke="#0b1220" stroke-width="3" marker-start="url(#cadArrowStart)" marker-end="url(#cadArrowEnd)" />
      <g transform="translate(${originX - 96}, ${originY + height / 2}) rotate(-90)">
        <rect x="-140" y="-36" width="280" height="52" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
        <text x="0" y="4" fill="#0b1220" font-size="38" font-weight="900" text-anchor="middle">H = ${height}</text>
      </g>
    `;
  }

  // Tytuł i metryka w lewym górnym rogu
  const headerSvg = `
    <g transform="translate(${originX}, ${Math.max(30, originY - 120)})">
      <rect x="-10" y="-22" width="${Math.min(width, 700)}" height="44" rx="6" fill="#0e7490" fill-opacity="0.08" stroke="#a5f3fc" stroke-width="1" />
      <text x="10" y="8" fill="#0e7490" font-size="24" font-weight="900" font-family="monospace">POZ. #${item.positionIndex || 1}: ${(item.name || "Konstrukcja").toUpperCase()}</text>
    </g>
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #ffffff;">
      <defs>
        <marker id="cadArrowStart" viewBox="0 0 16 16" refX="2" refY="8" markerWidth="16" markerHeight="16" orient="auto">
          <path d="M 16 2 L 2 8 L 16 14 z" fill="#0b1220" />
        </marker>
        <marker id="cadArrowEnd" viewBox="0 0 16 16" refX="14" refY="8" markerWidth="16" markerHeight="16" orient="auto">
          <path d="M 0 2 L 14 8 L 0 14 z" fill="#0b1220" />
        </marker>
      </defs>

      <!-- Tło arkusza -->
      <rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#ffffff" />
      <rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="none" stroke="#cbd5e1" stroke-width="3" />

      ${headerSvg}
      ${innerDrawing}
      ${dimensionsSvg}
    </svg>
  `.trim();
}

/**
 * Konwertuje ciąg znaków SVG na plik Blob formatu PNG w środowisku przeglądarki.
 */
export async function convertSvgToPngBlob(
  svgString: string,
  targetWidth = 1280,
  targetHeight = 800,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("convertSvgToPngBlob może być wywołany wyłącznie w przeglądarce.");
  }

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error(`Błąd ładowania SVG do elementu Image: ${String(e)}`));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Nie udało się uzyskać kontekstu 2d canvas");
    }

    // Czyste białe tło
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Skalowanie z zachowaniem proporcji (contain)
    const scale = Math.min(
      (targetWidth - 40) / (img.width || targetWidth),
      (targetHeight - 40) / (img.height || targetHeight),
    );
    const drawW = (img.width || targetWidth) * scale;
    const drawH = (img.height || targetHeight) * scale;
    const drawX = (targetWidth - drawW) / 2;
    const drawY = (targetHeight - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob zwrócił null"));
      }, "image/png", 0.95);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Generuje zrzuty CAD dla wszystkich pozycji i wgrywa je do magazynu Convex Storage.
 * Zwraca listę { positionIndex, imageUrl }.
 */
export async function uploadCadSnapshotsForOffer(
  items: CadConstructionItem[],
  generateUploadUrl: () => Promise<string>,
): Promise<Array<{ positionIndex: number; imageUrl: string }>> {
  const results: Array<{ positionIndex: number; imageUrl: string }> = [];

  for (const item of items) {
    try {
      const svg = renderCadConstructionSvg(item);
      const pngBlob = await convertSvgToPngBlob(svg, 1280, 800);

      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: pngBlob,
      });

      if (!uploadRes.ok) {
        console.warn(`[uploadCadSnapshotsForOffer] Błąd uploadu pozycji #${item.positionIndex}: ${uploadRes.status}`);
        continue;
      }

      const { storageId } = (await uploadRes.json()) as { storageId?: string };
      if (!storageId) continue;

      // URL w Convex HTTP
      // Jeśli storageId jest zapisane, Convex udostępnia endpoint pobierania
      // Zapisujemy URL storage pobrany z aplikacji
      results.push({
        positionIndex: item.positionIndex,
        imageUrl: storageId,
      });
    } catch (err) {
      console.warn(`[uploadCadSnapshotsForOffer] Błąd dla pozycji #${item.positionIndex}:`, err);
    }
  }

  return results;
}
