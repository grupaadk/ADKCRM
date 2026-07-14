"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export default function PrintComplaintsPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam.split(",").filter(Boolean) as Id<"complaints">[];

  const allComplaints = useQuery(api.complaints.getAll, {});
  const [readyToPrint, setReadyToPrint] = useState(false);

  const complaintsToPrint = allComplaints?.filter((c) => ids.includes(c._id)) || [];

  useEffect(() => {
    const today = new Date().toLocaleDateString("pl-PL").replace(/\./g, "-");
    document.title = `${today}_Zestawienie Reklamacji`;
  }, []);

  useEffect(() => {
    if (allComplaints && complaintsToPrint.length > 0 && !readyToPrint) {
      const timer = setTimeout(() => {
        setReadyToPrint(true);
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allComplaints, complaintsToPrint.length, readyToPrint]);

  if (!allComplaints) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Przygotowywanie dokumentów do druku...</div>;
  }

  if (complaintsToPrint.length === 0) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Brak reklamacji do druku.</div>;
  }

  return (
    <div className="print-wrapper" style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif", background: "#fff", color: "#000" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body, html { background: white !important; margin: 0; padding: 0; height: auto; min-height: 0; }
          .print-wrapper { min-height: 0 !important; padding: 10mm; }
          .no-print { display: none !important; }
          @page { size: landscape; margin: 0; }
        }
      `}} />
      
      <div className="no-print" style={{ padding: "20px", textAlign: "center", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
        <button 
          onClick={() => window.print()}
          style={{ padding: "10px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
        >
          Drukuj ponownie
        </button>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Zestawienie Reklamacji</h1>
            <p style={{ margin: "4px 0 0", color: "#4b5563", fontSize: 14 }}>Dokument wygenerowany z systemu</p>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Data wygenerowania: {new Date().toLocaleDateString("pl-PL")}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000", textAlign: "left" }}>
              <th style={{ padding: "8px 6px" }}>Zgłoszenie</th>
              <th style={{ padding: "8px 6px" }}>Serwis</th>
              <th style={{ padding: "8px 6px" }}>Klient</th>
              <th style={{ padding: "8px 6px" }}>Adres</th>
              <th style={{ padding: "8px 6px" }}>Telefon</th>
              <th style={{ padding: "8px 6px" }}>Zlecenie</th>
              <th style={{ padding: "8px 6px", width: "20%" }}>Opis</th>
              <th style={{ padding: "8px 6px", width: "15%" }}>Notatki</th>
            </tr>
          </thead>
          <tbody>
            {complaintsToPrint.map((c) => {
              const clientName = [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ") || c.client?.companyName || "Brak danych";
              
              let addr = "—";
              
              const getClientAddress = (client: any) => {
                if (!client) return "";
                const street = [client.street, client.buildingNumber].filter(Boolean).join(" ");
                const apt = client.apartmentNumber ? `/${client.apartmentNumber}` : "";
                const fullStreet = `${street}${apt}`.trim();
                const city = client.city?.trim() || "";
                if (fullStreet || city) {
                  return `${fullStreet ? fullStreet + ", " : ""}${city}`;
                }
                return client.address?.trim() || "";
              };

              if (c.order) {
                const street = [c.order.investmentStreet, c.order.investmentBuildingNumber].filter(Boolean).join(" ");
                const apt = c.order.investmentApartmentNumber ? `/${c.order.investmentApartmentNumber}` : "";
                const fullStreet = `${street}${apt}`.trim();
                const city = c.order.investmentCity?.trim() || "";
                
                let rawAddr = fullStreet || city ? `${fullStreet ? fullStreet + ", " : ""}${city}` : "";
                addr = `ADRES INWESTYCJI: ${rawAddr || "Brak danych"}`;
              } else if (c.client) {
                const rawAddr = getClientAddress(c.client);
                addr = `ADRES KLIENTA: ${rawAddr || "Brak danych"}`;
              }

              const allNotes = [
                ...(c.notes || []).map((n: any) => ({ date: n.createdAt, text: n.text })),
                ...(c.entries || [])
                  .filter((e: any) => e.type === "note")
                  .map((e: any) => ({ date: e.createdAt, text: e.text })),
              ].sort((a, b) => a.date - b.date);

              return (
                <tr key={c._id} style={{ borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{new Date(c.startDate).toLocaleDateString("pl-PL")}</td>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap", fontWeight: 600 }}>{c.serviceDate ? new Date(c.serviceDate).toLocaleDateString("pl-PL") : "—"}</td>
                  <td style={{ padding: "8px 6px", fontWeight: 500 }}>{clientName}</td>
                  <td style={{ padding: "8px 6px" }}>{addr}</td>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{c.client?.phone || "—"}</td>
                  <td style={{ padding: "8px 6px" }}>{c.order?.name || "—"}</td>
                  <td style={{ padding: "8px 6px", whiteSpace: "pre-wrap", color: "#4b5563" }}>
                    {c.clientDescription || c.description || "—"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {allNotes.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {allNotes.map((n: any, i: number) => (
                          <div key={i} style={{ fontSize: 9 }}>
                            <span style={{ color: "#374151", fontWeight: 700, marginRight: 4 }}>
                              {new Date(n.date).toLocaleDateString("pl-PL")}:
                            </span>
                            <span style={{ color: "#4b5563" }}>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
