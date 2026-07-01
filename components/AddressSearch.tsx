"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export interface AddressData {
  street?: string;
  buildingNumber?: string;
  city?: string;
  postalCode?: string;
}

interface Suggestion {
  placeId: string;
  text: string;
}

interface AddressSearchProps {
  onSelect: (address: AddressData) => void;
  className?: string;
}

export default function AddressSearch({ onSelect, className }: AddressSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const searchAddresses = useAction(api.places.searchAddresses);
  const getPlaceDetails = useAction(api.places.getPlaceDetails);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const handleInput = useCallback(
    (value: string) => {
      setInputValue(value);
      setOpen(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.length < 3) {
        setSuggestions([]);
        return;
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        searchAddresses({ input: value })
          .then((results) => setSuggestions(results))
          .catch(() => setSuggestions([]))
          .finally(() => setLoading(false));
      }, 300);
    },
    [searchAddresses]
  );

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      setOpen(false);
      setSuggestions([]);
      setInputValue("");
      setLoading(true);
      getPlaceDetails({ placeId: suggestion.placeId })
        .then((details) => onSelectRef.current(details))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [getPlaceDetails]
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors focus-within:border-blue-400 focus-within:bg-white ${
          loading ? "border-blue-300 bg-blue-50" : "border-blue-200 bg-blue-50"
        }`}
      >
        {/* Pin icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0 text-blue-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Wyszukaj adres, aby uzupełnić pola..."
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />

        {loading ? (
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <span className="shrink-0 text-[10px] font-medium text-slate-400">
            Google Maps
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId} className="border-t border-slate-100 first:border-t-0">
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
