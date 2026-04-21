"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Delete } from "lucide-react";

const CORRECT_PIN = process.env.NEXT_PUBLIC_FAKTURY_PIN ?? "";

interface PinGateProps {
  children: React.ReactNode;
}

export default function PinGate({ children }: PinGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const verify = useCallback((pin: string) => {
    if (pin === CORRECT_PIN) {
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setDigits([]);
      setTimeout(() => {
        setError(false);
        setShake(false);
      }, 600);
    }
  }, []);

  const press = useCallback(
    (key: string) => {
      if (key === "del") {
        setDigits((d) => d.slice(0, -1));
        setError(false);
        return;
      }
      const next = [...digits, key];
      setDigits(next);
      if (next.length === 4) {
        verify(next.join(""));
      }
    },
    [digits, verify]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [press]);

  if (unlocked) return <>{children}</>;

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-10 text-center" style={{ background: "linear-gradient(135deg, #4ABBC3, #3aa8b0)" }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white">Dostęp do Faktur</h1>
            <p className="mt-1 text-sm text-blue-100">Wprowadź 4-cyfrowy PIN</p>
          </div>

          {/* PIN dots */}
          <div className="px-8 py-6">
            <div
              className={`flex justify-center gap-4 mb-2 transition-transform ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    digits[i] !== undefined
                      ? error
                        ? "bg-red-500 border-red-500 scale-110"
                        : "bg-blue-600 border-blue-600 scale-110"
                      : "border-gray-300 bg-transparent"
                  }`}
                />
              ))}
            </div>
            <div className="h-5 text-center">
              {error && (
                <p className="text-sm text-red-500 font-medium">Nieprawidłowy PIN</p>
              )}
            </div>
          </div>

          {/* Keypad */}
          <div className="px-6 pb-8 grid grid-cols-3 gap-3">
            {keys.map((key, idx) => {
              if (key === "") {
                return <div key={idx} />;
              }
              if (key === "del") {
                return (
                  <button
                    key={idx}
                    onClick={() => press("del")}
                    disabled={digits.length === 0}
                    className="h-14 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                );
              }
              return (
                <button
                  key={idx}
                  onClick={() => press(key)}
                  disabled={digits.length === 4}
                  className="h-14 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 text-gray-800 text-xl font-semibold transition-colors select-none"
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
