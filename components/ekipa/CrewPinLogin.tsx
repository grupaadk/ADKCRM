"use client";

import { useState } from "react";
import { Lock, Delete, Wrench, Shield } from "lucide-react";

interface CrewPinLoginProps {
  onSuccess: (pin: string) => void;
  errorMsg?: string | null;
  loading?: boolean;
}

export function CrewPinLogin({ onSuccess, errorMsg, loading }: CrewPinLoginProps) {
  const [pin, setPin] = useState("");

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        onSuccess(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-between p-6 max-w-sm mx-auto w-full min-h-[100dvh]"
      style={{ background: "var(--background)" }}
    >
      {/* Top spacing / Badge */}
      <div className="pt-6 text-center">
        <div className="pill acc shadow-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>Grupa ADK PWA Ekipy</span>
        </div>
      </div>

      {/* Brand & Title */}
      <div className="text-center space-y-3 w-full my-auto">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-md border"
          style={{
            background: "var(--accent-soft)",
            borderColor: "var(--accent-line)",
          }}
        >
          <Wrench className="w-10 h-10" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight strong">Logowanie Ekipy</h1>
          <p className="text-xs dim mt-1 font-medium">
            Wpisz swój 4-cyfrowy PIN dostępowy
          </p>
        </div>

        {/* PIN Dots Indicator */}
        <div className="flex items-center justify-center gap-4 py-4">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  filled
                    ? "scale-125 shadow-xs"
                    : "border"
                }`}
                style={{
                  background: filled ? "var(--accent)" : "var(--panel-2)",
                  borderColor: filled ? "var(--accent)" : "var(--line-2)",
                }}
              />
            );
          })}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl pill bad text-xs font-semibold text-center w-full animate-in fade-in zoom-in-95">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full space-y-6 pb-6">
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-2xl btn text-2xl font-bold strong justify-center active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              style={{ background: "var(--panel)" }}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="h-16 rounded-2xl btn text-xs font-bold dim justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
            style={{ background: "var(--panel-2)" }}
          >
            C
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit("0")}
            className="h-16 rounded-2xl btn text-2xl font-bold strong justify-center active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
            style={{ background: "var(--panel)" }}
          >
            0
          </button>

          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-16 rounded-2xl btn dim justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
            style={{ background: "var(--panel-2)" }}
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs font-medium" style={{ color: "var(--accent)" }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
            Weryfikowanie PIN-u...
          </div>
        )}

        <div className="text-center text-[11px] mute flex items-center gap-1.5 justify-center font-medium">
          <Lock className="w-3.5 h-3.5" />
          Bezpieczne połączenie z dyspozytornią Grupa ADK
        </div>
      </div>
    </div>
  );
}
