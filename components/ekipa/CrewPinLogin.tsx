"use client";

import { useState } from "react";
import { Lock, Delete, Wrench } from "lucide-react";

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
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-sm mx-auto w-full">
      {/* Brand & Title */}
      <div className="text-center space-y-3 mb-8">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
          <Wrench className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">ADK Ekipy</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Podaj 4-cyfrowy PIN logowania ekipy monterskiej
          </p>
        </div>
      </div>

      {/* PIN Dots Indicator */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {[0, 1, 2, 3].map((idx) => {
          const filled = idx < pin.length;
          return (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                filled
                  ? "bg-emerald-400 scale-110 shadow-md shadow-emerald-500/30 ring-4 ring-emerald-500/20"
                  : "bg-slate-800 border border-slate-700"
              }`}
            />
          );
        })}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center animate-in fade-in zoom-in-95">
          {errorMsg}
        </div>
      )}

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3.5 w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            disabled={loading}
            onClick={() => handleDigit(num)}
            className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-700 text-2xl font-bold text-white border border-slate-700/60 shadow-sm flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={handleClear}
          className="h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 border border-slate-800 flex items-center justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          C
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleDigit("0")}
          className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-700 text-2xl font-bold text-white border border-slate-700/60 shadow-sm flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-400">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Weryfikowanie PIN-u...
        </div>
      )}

      <div className="mt-12 text-center text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
        <Lock className="w-3.5 h-3.5" />
        Szyfrowany dostęp bezpośredni dla ekip ADK
      </div>
    </div>
  );
}
