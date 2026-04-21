"use client";

const DOC_KEYS: Array<{ key: string; label: string }> = [
  { key: "pomiar", label: "Pomiar" },
  { key: "umowa", label: "Umowa" },
  { key: "rekojmia_adk", label: "Rękojmia ADK" },
  { key: "odbior_inwestor", label: "Odbiór inwestorski" },
  { key: "protokol_montaz", label: "Protokół montażu" },
  { key: "gwarancja_alco", label: "Gwarancja ALCO" },
  { key: "reklamacja", label: "Reklamacja" },
];

type DocEntry = {
  url?: string;
  signatureStatus?: "signed" | "not_applicable";
};

function tileColor(doc: DocEntry | undefined): string {
  if (!doc?.url) return "bg-slate-300";
  if (doc.signatureStatus === "signed") return "bg-green-500";
  if (doc.signatureStatus === "not_applicable") return "bg-yellow-400";
  return "bg-red-400";
}

export default function DocumentProgressTiles({
  documents,
}: {
  documents?: Record<string, DocEntry>;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {DOC_KEYS.map(({ key, label }) => (
        <div
          key={key}
          title={label}
          className={`h-2.5 w-2.5 rounded-sm ${tileColor(documents?.[key])}`}
        />
      ))}
    </div>
  );
}
