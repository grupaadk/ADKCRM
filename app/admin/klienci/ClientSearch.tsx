"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

export default function ClientSearch() {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useQuery(
    api.clients.search,
    searchTerm.length >= 2 ? { searchTerm } : "skip",
  );

  const showDropdown = isOpen && searchTerm.length >= 2;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Szukaj klienta po nazwisku..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue("");
              setSearchTerm("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-80 overflow-y-auto">
          {results === undefined && (
            <div className="px-4 py-3 text-sm text-gray-400">Szukam...</div>
          )}
          {results !== undefined && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              Brak wynikow dla &quot;{searchTerm}&quot;
            </div>
          )}
          {results?.map((client) => (
            <Link
              key={client._id}
              href={`/admin/klient/${client._id}`}
              onClick={() => {
                setIsOpen(false);
                setInputValue("");
              }}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-gray-900 truncate">
                  {client.firstName} {client.lastName}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {[client.city, client.email, client.phone]
                    .filter(Boolean)
                    .join(" \u00B7 ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
