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
  Plus,
  MessageSquare,
  Trash2,
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

type Conversation = {
  id: string;
  title: string;
  date: string;
  messages: Message[];
};

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  sender: "assistant",
  text: "Cześć! Jestem Twoim Asystentem Wycen ADK Okna. Opisz czego potrzebujesz (np. 'Wycena okien PVC dla Pana Marka z Poznania, 3 okna 120x150 w kolorze Antracyt z montażem') lub zadaj mi dowolne pytanie dotyczące wyceny.",
  timestamp: "10:00",
};

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    title: "Jan Kowalski — 4x okna PVC Aluplast",
    date: "Dzisiaj",
    messages: [
      WELCOME_MESSAGE,
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
            { id: "item-1", name: "Okno PVC Aluplast IDEAL 7000 (2-szybowe)", specs: "Wymiary: 1400x1400 mm | Kolor: Złoty Dąb | Pakiet 4/16/4", qty: 4, priceNet: 1150, vat: 8 },
            { id: "item-2", name: "Ciepły montaż warstwowy", specs: "Obwód: 22.4 mb | Zgodnie ze standardem ADK", qty: 1, priceNet: 960, vat: 8 },
            { id: "item-3", name: "Dostawa na plac budowy", specs: "Wrocław i okolice (do 50km)", qty: 1, priceNet: 250, vat: 23 },
          ],
          summary: { netTotal: 5810, vatTotal: 504.3, grossTotal: 6314.3 },
        },
      },
    ],
  },
  {
    id: "conv-2",
    title: "Anna Nowak — drzwi tarasowe HST",
    date: "Dzisiaj",
    messages: [
      WELCOME_MESSAGE,
      { id: "c2-1", sender: "user", text: "Potrzebuję wycenę drzwi tarasowych HST przesuwnych 3000x2200 mm, profil aluminiowy Yawal TM 77HI, kolor antracyt RAL 7016, pakiet trójszybowy.", timestamp: "11:30" },
      { id: "c2-2", sender: "assistant", text: "Przygotowałem wstępną kalkulację drzwi tarasowych HST. System Yawal TM 77HI z profilem termicznym to świetny wybór do dużych przeszkleń.", timestamp: "11:30" },
    ],
  },
  {
    id: "conv-3",
    title: "Firma BudMax — 12 okien + brama",
    date: "Wczoraj",
    messages: [
      WELCOME_MESSAGE,
      { id: "c3-1", sender: "user", text: "Wycena kompleksowa dla firmy BudMax sp. z o.o. — 12 okien PVC białych różne wymiary, 1 brama garażowa segmentowa 3000x2500 oraz montaż.", timestamp: "14:15" },
      { id: "c3-2", sender: "assistant", text: "To większy projekt. Przygotowałem wstępny kosztorys dla 12 okien i bramy garażowej z montażem.", timestamp: "14:16" },
    ],
  },
  {
    id: "conv-4",
    title: "Marek Zieliński — rolety + okna",
    date: "Wczoraj",
    messages: [
      WELCOME_MESSAGE,
      { id: "c4-1", sender: "user", text: "6 okien PVC 120x150 z roletami podtynkowymi + montaż, Poznań.", timestamp: "09:00" },
    ],
  },
  {
    id: "conv-5",
    title: "Ewa Wiśniewska — wymiana stolarki",
    date: "01.09.2026",
    messages: [
      WELCOME_MESSAGE,
      { id: "c5-1", sender: "user", text: "Wymiana 8 okien w starym budownictwie na nowe PVC z ciepłym montażem, Kraków.", timestamp: "16:20" },
    ],
  },
];

export default function WycenaAIPage() {
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string>(DEMO_CONVERSATIONS[0].id);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const messages = activeConv?.messages ?? [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping]);

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: "Nowa wycena",
      date: "Dzisiaj",
      messages: [
        {
          id: `welcome-${Date.now()}`,
          sender: "assistant",
          text: "Rozpoczęliśmy nową kalkulację. Wpisz szczegóły zlecenia, parametry okien/drzwi lub dane klienta.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
  };

  const handleDeleteConversation = (convId: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId);
      if (convId === activeConvId && filtered.length > 0) {
        setActiveConvId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleSend = () => {
    if (!input.trim() || !activeConv) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Update title if it's the first user message in "Nowa wycena"
    const isFirstUserMsg = activeConv.title === "Nowa wycena";
    const newTitle = isFirstUserMsg ? input.trim().slice(0, 50) : activeConv.title;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, title: newTitle, messages: [...c.messages, userMsg] }
          : c,
      ),
    );
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
            { id: "item-1", name: "Okno PVC Aluplast IDEAL 7000 (2-szybowe)", specs: "Wymiary: 1400x1400 mm | Kolor: Złoty Dąb | Rabat 5%", qty: 4, priceNet: 1092.5, vat: 8 },
            { id: "item-2", name: "Roleta podtynkowa Integro z silnikiem Somfy", specs: "Wymiary: 1400x1400 mm | Kolor skrzynki: Złoty Dąb", qty: 4, priceNet: 890, vat: 8 },
            { id: "item-3", name: "Ciepły montaż warstwowy + montaż rolet", specs: "Montaż stolarki i automatyki", qty: 1, priceNet: 1400, vat: 8 },
          ],
          summary: { netTotal: 9330, vatTotal: 746.4, grossTotal: 10076.4 },
        },
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, messages: [...c.messages, assistantMsg] }
            : c,
        ),
      );
      setIsTyping(false);
    }, 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Grupowanie po dacie
  const dateGroups: Record<string, Conversation[]> = {};
  for (const c of conversations) {
    if (!dateGroups[c.date]) dateGroups[c.date] = [];
    dateGroups[c.date].push(c);
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 7rem)", minHeight: 400, gap: 16 }}>
      {/* ── Lewy panel: Historia wycen ── */}
      <div
        className="panel"
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Przycisk nowej wyceny */}
        <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
          <button
            className="btn primary"
            onClick={handleNewConversation}
            style={{ width: "100%", justifyContent: "center", padding: "8px 12px", borderRadius: 8 }}
          >
            <Plus size={14} />
            Nowa wycena
          </button>
        </div>

        {/* Lista konwersacji */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {Object.entries(dateGroups).map(([date, convs]) => (
            <div key={date}>
              <div
                className="up mute"
                style={{ padding: "10px 14px 4px", fontSize: 10 }}
              >
                {date}
              </div>
              {convs.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 14px",
                    margin: "1px 6px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: conv.id === activeConvId ? "var(--accent-soft)" : "transparent",
                    border: conv.id === activeConvId ? "1px solid var(--accent-line)" : "1px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (conv.id !== activeConvId) e.currentTarget.style.background = "var(--panel-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (conv.id !== activeConvId) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <MessageSquare
                      size={13}
                      style={{
                        flexShrink: 0,
                        color: conv.id === activeConvId ? "var(--accent)" : "var(--text-mute)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: conv.id === activeConvId ? 600 : 400,
                        color: conv.id === activeConvId ? "var(--text-strong)" : "var(--text-dim)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {conv.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      color: "var(--text-mute)",
                      opacity: 0.4,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--bad)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-mute)"; }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Prawy panel: Czat ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, gap: 16 }}>
        {/* Nagłówek czatu */}
        <div
          className="panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
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
                  {activeConv?.title ?? "Asystent Wycen ADK"}
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
        </div>

        {/* Strumień wiadomości */}
        <div
          className="panel"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
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
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--panel-2)", color: "var(--accent)", border: "1px solid var(--line)" }),
                    }}
                  >
                    {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>

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
                          ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                          : { background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 }),
                      }}
                    >
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                    </div>

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

                        <div style={{ padding: "0 16px" }}>
                          {msg.estimateCard.items.map((item, i) => (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 0",
                                borderBottom: i < msg.estimateCard!.items.length - 1 ? "1px solid var(--line)" : "none",
                                gap: 16,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>{item.name}</div>
                                <div className="mute" style={{ fontSize: 11, marginTop: 1 }}>{item.specs}</div>
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

                        <div style={{ borderTop: "1px solid var(--line)", background: "var(--panel-2)", padding: "12px 16px" }}>
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

              {isTyping && (
                <div style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: "var(--panel-2)", color: "var(--accent)", border: "1px solid var(--line)",
                    }}
                  >
                    <Bot size={16} />
                  </div>
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      borderRadius: 12, padding: "10px 16px",
                      background: "var(--panel-2)", border: "1px solid var(--line)", borderBottomLeftRadius: 4,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "wycena-bounce 1.4s infinite", animationDelay: "0ms" }} />
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "wycena-bounce 1.4s infinite", animationDelay: "200ms" }} />
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "wycena-bounce 1.4s infinite", animationDelay: "400ms" }} />
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
          style={{ padding: "12px 16px", flexShrink: 0 }}
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
                  flex: 1, resize: "none", background: "transparent", border: "none", outline: "none",
                  fontSize: 13, lineHeight: 1.5, color: "var(--text)", fontFamily: "inherit", padding: "6px 0",
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
      </div>

      <style jsx>{`
        @keyframes wycena-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
