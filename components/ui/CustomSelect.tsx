"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string | number> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  customOptionLabel?: string;
  onSelectCustom?: () => void;
}

export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "-- Wybierz --",
  disabled = false,
  className = "",
  customOptionLabel,
  onSelectCustom,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-white text-sm font-semibold text-[var(--text-strong)] transition-all shadow-2xs ${
          isOpen
            ? "border-brand ring-2 ring-brand/20 shadow-sm"
            : "border-[var(--line-2)] hover:border-brand/60"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-[var(--panel-2)]" : "cursor-pointer"}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-brand" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[var(--line-2)] bg-white p-1.5 shadow-lg space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors ${
                  isSelected
                    ? "bg-brand text-white shadow-2xs font-bold"
                    : "text-[var(--text-strong)] hover:bg-brand/10 hover:text-brand"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 stroke-[2.5] shrink-0 ml-2" />}
              </button>
            );
          })}

          {customOptionLabel && onSelectCustom && (
            <button
              type="button"
              onClick={() => {
                onSelectCustom();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left text-brand hover:bg-brand/10 transition-colors border-t border-[var(--line-2)] mt-1 pt-2"
            >
              <span>{customOptionLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
