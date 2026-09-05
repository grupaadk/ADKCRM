"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  User,
  Bot,
  Plus,
  FileSpreadsheet,
  Check,
  ChevronDown,
  Edit2,
  Trash2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Calculator,
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

    // Symulacja odpowiedzi AI
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
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-900 text-slate-100">
      {/* Pasek nagłówka czatu */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Asystent Wycen ADK</h1>
              <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-400 border border-teal-500/20">
                GPT-4o Stolarka
              </span>
            </div>
            <p className="text-xs text-slate-400">Inteligentny generator kosztorysów i kalkulator stolarki okiennej</p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Nowa wycena
        </button>
      </header>

      {/* Strumień konwersacji ChatGPT (Center focused) */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-800">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${
                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Awatar */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${
                  msg.sender === "user"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-900/30"
                    : "bg-slate-800 text-teal-400 ring-1 ring-slate-700"
                }`}
              >
                {msg.sender === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>

              {/* Treść wiadomości */}
              <div
                className={`flex max-w-[85%] flex-col gap-2 ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-teal-600 text-white shadow-md shadow-teal-950/40"
                      : "bg-slate-800/80 text-slate-200 border border-slate-700/60 backdrop-blur-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Karta wyceny (jeśli dołączona do odpowiedzi AI) */}
                {msg.estimateCard && (
                  <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-black/40">
                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="h-4 w-4 text-teal-400" />
                        <span className="font-semibold text-white text-sm">{msg.estimateCard.title}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {msg.estimateCard.clientName}
                      </span>
                    </div>

                    {/* Pozycje wyceny */}
                    <div className="divide-y divide-slate-800/60 px-5 py-2">
                      {msg.estimateCard.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-3">
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-slate-100">{item.name}</div>
                            <div className="text-xs text-slate-400">{item.specs}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              {(item.priceNet * item.qty).toLocaleString("pl-PL")} PLN netto
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {item.qty} szt. x {item.priceNet} PLN (VAT {item.vat}%)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Podsumowanie finansowe */}
                    <div className="border-t border-slate-800 bg-slate-900/50 px-5 py-3.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Suma netto:</span>
                        <span>{msg.estimateCard.summary.netTotal.toLocaleString("pl-PL")} PLN</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Podatek VAT:</span>
                        <span>{msg.estimateCard.summary.vatTotal.toLocaleString("pl-PL")} PLN</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-teal-400 pt-2 border-t border-slate-800/80">
                        <span>RAZEM BRUTTO:</span>
                        <span className="text-base">{msg.estimateCard.summary.grossTotal.toLocaleString("pl-PL")} PLN</span>
                      </div>

                      {/* Akcje pod wyceną */}
                      <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-800/50">
                        <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500 shadow-lg shadow-teal-950/50">
                          <Check className="h-3.5 w-3.5" />
                          Zapisz i utwórz zlecenie w CRM
                        </button>
                        <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
                          <Edit2 className="h-3.5 w-3.5" />
                          Edytuj pozycje
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <span className="text-[10px] text-slate-500 px-1">{msg.timestamp}</span>
              </div>
            </div>
          ))}

          {/* Indicator pisania */}
          {isTyping && (
            <div className="flex gap-4 flex-row">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-teal-400 ring-1 ring-slate-700">
                <Bot className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-slate-800/80 px-4 py-3 border border-slate-700/60">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pole wprowadzania wiadomości w stylu ChatGPT */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-2xl focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Zapytaj Asystenta lub podaj dane wyceny (np. 5 okien PVC, rolety, kolor antracyt)..."
              rows={2}
              className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none scrollbar-none"
            />
            <div className="flex items-center gap-2 p-2.5">
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-slate-950 transition-all hover:bg-teal-400 disabled:opacity-30 disabled:hover:bg-teal-500"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Asystent Wycen ADK AI generuje propozycje kosztorysów. Zweryfikuj wycenę przed wysłaniem do klienta.
          </p>
        </div>
      </footer>
    </div>
  );
}
