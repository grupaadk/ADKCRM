"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  User,
  Bot,
  FileSpreadsheet,
  Check,
  Edit2,
  RotateCcw,
} from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  estimateCard?: {
    title: string;
    clientName?: string;
    items: Array<{
      id: string;
      name: string;
      specs: string;
      qty: number;
      priceNet: number;
      vat: number;
    }>;
    summary: {
      netTotal: number;
      vatTotal: number;
      grossTotal: number;
    };
  };
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-1",
    sender: "assistant",
    text: "Cześć! Jestem Twoim Asystentem Wycen ADK Okna. Opisz czego potrzebujesz (np. 'Wycena okien PVC dla Pana Marka z Poznania, 3 okna 120x150 w kolorze Antracyt z montażem') lub zadaj mi dowolne pytanie dotyczące wyceny.",
    timestamp: "10:00",
  },
  {
    id: "msg-2",
    sender: "user",
    text: "Cześć, przygotuj wycenę dla klienta Jan Kowalski z Wrocławia. Potrzebuje 4 okna PVC dwuszybowe profil Aluplast 7000 (140x140 cm) kolor złoty dąb oraz ciepły montaż.",
    timestamp: "10:02",
  },
  {
    id: "msg-3",
    sender: "assistant",
    text: "Przeanalizowałem zapytanie i przygotowałem wstępną kalkulację kosztów dla Pana Jana Kowalskiego. Sprawdź poniższą specyfikację i daj znać, czy chcesz wygenerować oficjalną wycenę w CRM lub dodać rabat.",
    timestamp: "10:02",
    estimateCard: {
      title: "Wycena #WYC-2026/09/004",
      clientName: "Jan Kowalski (Wrocław)",
      items: [
        {
          id: "item-1",
          name: "Okno PVC Aluplast IDEAL 7000 (2-szybowe)",
          specs: "Wymiary: 1400x1400 mm | Kolor: Złoty Dąb | Pakiet 4/16/4",
          qty: 4,
          priceNet: 1150,
          vat: 8,
        },
        {
          id: "item-2",
          name: "Ciepły montaż warstwowy (taśmy paroszczelne/przepuszczalne)",
          specs: "Obwód: 22.4 mb | Zgodnie ze standardem ADK",
          qty: 1,
          priceNet: 960,
          vat: 8,
        },
        {
          id: "item-3",
          name: "Dostawa na plac budowy",
          specs: "Wrocław i okolice (do 50km)",
          qty: 1,
          priceNet: 250,
          vat: 23,
        },
      ],
      summary: {
        netTotal: 5810,
        vatTotal: 504.3,
        grossTotal: 6314.3,
      },
    },
  },
];

export default function WycenaAIPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: "Zaktualizowałem parametry kalkulacji. Dodałem rolety podtynkowe oraz uwzględniłem 5% rabatu na stolarkę. Poniżej znajduje się przeliczone podsumowanie.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        estimateCard: {
          title: "Zaktualizowana Wycena #WYC-2026/09/004",
          clientName: "Jan Kowalski (Wrocław)",
          items: [
            {
              id: "item-1",
              name: "Okno PVC Aluplast IDEAL 7000 (2-szybowe)",
              specs: "Wymiary: 1400x1400 mm | Kolor: Złoty Dąb | Rabat 5%",
              qty: 4,
              priceNet: 1092.5,
              vat: 8,
            },
            {
              id: "item-2",
              name: "Roleta podtynkowa Integro z silnikiem Somfy",
              specs: "Wymiary: 1400x1400 mm | Kolor skrzynki: Złoty Dąb",
              qty: 4,
              priceNet: 890,
              vat: 8,
            },
            {
              id: "item-3",
              name: "Ciepły montaż warstwowy + montaż rolet",
              specs: "Montaż stolarki i automatyki",
              qty: 1,
              priceNet: 1400,
              vat: 8,
            },
          ],
          summary: {
            netTotal: 9330,
            vatTotal: 746.4,
            grossTotal: 10076.4,
          },
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `asst-reset-${Date.now()}`,
        sender: "assistant",
        text: "Rozpoczęliśmy nową kalkulację. Wpisz szczegóły zlecenia, parametry okien/drzwi lub dane klienta.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 7rem)", minHeight: 400 }}>
      {/* Nagłówek */}
      <div
        className="panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
                Asystent Wycen ADK
              </span>
              <span className="pill acc" style={{ fontSize: 10, padding: "1px 7px" }}>
                AI
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
              Inteligentny generator kosztorysów i kalkulator stolarki
            </div>
          </div>
        </div>

        <button className="btn" onClick={handleResetChat}>
          <RotateCcw size={13} />
          Nowa wycena
        </button>
      </div>

      {/* Strumień wiadomości */}
      <div
        className="panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 20px",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: 12,
                  flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                }}
              >
                {/* Awatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    ...(msg.sender === "user"
                      ? {
                          background: "var(--accent)",
                          color: "#fff",
                        }
                      : {
                          background: "var(--panel-2)",
                          color: "var(--accent)",
                          border: "1px solid var(--line)",
                        }),
                  }}
                >
                  {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Treść */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxWidth: "85%",
                    alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.6,
                      ...(msg.sender === "user"
                        ? {
                            background: "var(--accent)",
                            color: "#fff",
                            borderBottomRightRadius: 4,
                          }
                        : {
                            background: "var(--panel-2)",
                            color: "var(--text)",
                            border: "1px solid var(--line)",
                            borderBottomLeftRadius: 4,
                          }),
                    }}
                  >
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                  </div>

                  {/* Karta wyceny */}
                  {msg.estimateCard && (
                    <div
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "var(--panel)",
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      {/* Nagłówek karty */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 16px",
                          borderBottom: "1px solid var(--line)",
                          background: "var(--panel-2)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileSpreadsheet size={14} style={{ color: "var(--accent)" }} />
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text-strong)" }}>
                            {msg.estimateCard.title}
                          </span>
                        </div>
                        <span className="mute" style={{ fontSize: 11 }}>
                          {msg.estimateCard.clientName}
                        </span>
                      </div>

                      {/* Pozycje */}
                      <div style={{ padding: "0 16px" }}>
                        {msg.estimateCard.items.map((item, i) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 0",
                              borderBottom:
                                i < msg.estimateCard!.items.length - 1
                                  ? "1px solid var(--line)"
                                  : "none",
                              gap: 16,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>
                                {item.name}
                              </div>
                              <div className="mute" style={{ fontSize: 11, marginTop: 1 }}>
                                {item.specs}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>
                                {(item.priceNet * item.qty).toLocaleString("pl-PL")} zł
                              </div>
                              <div className="mute mono" style={{ fontSize: 10.5 }}>
                                {item.qty} szt. × {item.priceNet.toLocaleString("pl-PL")} zł (VAT {item.vat}%)
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Podsumowanie */}
                      <div
                        style={{
                          borderTop: "1px solid var(--line)",
                          background: "var(--panel-2)",
                          padding: "12px 16px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-mute)", marginBottom: 3 }}>
                          <span>Suma netto:</span>
                          <span className="mono">{msg.estimateCard.summary.netTotal.toLocaleString("pl-PL")} zł</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-mute)", marginBottom: 8 }}>
                          <span>Podatek VAT:</span>
                          <span className="mono">{msg.estimateCard.summary.vatTotal.toLocaleString("pl-PL")} zł</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--accent)",
                            paddingTop: 8,
                            borderTop: "1px solid var(--line)",
                          }}
                        >
                          <span>RAZEM BRUTTO:</span>
                          <span className="mono" style={{ fontSize: 14 }}>
                            {msg.estimateCard.summary.grossTotal.toLocaleString("pl-PL")} zł
                          </span>
                        </div>

                        {/* Akcje */}
                        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                          <button className="btn primary" style={{ flex: 1 }}>
                            <Check size={13} />
                            Zapisz i utwórz zlecenie w CRM
                          </button>
                          <button className="btn">
                            <Edit2 size={13} />
                            Edytuj pozycje
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <span className="mute" style={{ fontSize: 10, paddingLeft: 4 }}>{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {/* Pisanie */}
            {isTyping && (
              <div style={{ display: "flex", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: "var(--panel-2)",
                    color: "var(--accent)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Bot size={16} />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 12,
                    padding: "10px 16px",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderBottomLeftRadius: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      animation: "bounce 1.4s infinite",
                      animationDelay: "0ms",
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      animation: "bounce 1.4s infinite",
                      animationDelay: "200ms",
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      animation: "bounce 1.4s infinite",
                      animationDelay: "400ms",
                    }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Pole wprowadzania */}
      <div
        className="panel"
        style={{
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              padding: "4px 4px 4px 14px",
              transition: "border-color 0.15s",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Zapytaj Asystenta lub podaj dane wyceny..."
              rows={2}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text)",
                fontFamily: "inherit",
                padding: "6px 0",
              }}
            />
            <button
              className="btn primary"
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ padding: "6px 10px", borderRadius: 8 }}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="mute" style={{ textAlign: "center", fontSize: 10, marginTop: 6 }}>
            Asystent Wycen ADK AI generuje propozycje kosztorysów. Zweryfikuj wycenę przed wysłaniem do klienta.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
