"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Search, Star } from "lucide-react";

interface GlobalSearchCommandProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecentSearch {
  id: string;
  title: string;
  subtitle?: string;
  customText?: string;
  tags?: string[];
  type: "klienci" | "zlecenia" | "szanse" | "zadania" | "reklamacje";
  url: string;
  timestamp: number;
}

const RECENT_ITEMS_KEY = "adk_crm_recent_searches_v2";
const FAVORITES_KEY = "adk_crm_favorites_v2";

function getFavorites(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleFavoriteStorage(item: RecentSearch): boolean {
  if (typeof window === "undefined") return false;
  try {
    let items = getFavorites();
    const exists = items.some((i) => i.id === item.id);
    if (exists) {
      items = items.filter((i) => i.id !== item.id);
    } else {
      items.unshift(item);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
    return !exists;
  } catch {
    return false;
  }
}

function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(item: RecentSearch) {
  if (typeof window === "undefined") return;
  try {
    const items = getRecentSearches().filter((i) => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // Ignore storage errors
  }
}

function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_ITEMS_KEY);
  } catch {
    // Ignore
  }
}

export function GlobalSearchCommand({ isOpen, onClose }: GlobalSearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "klienci" | "zlecenia" | "szanse" | "zadania" | "reklamacje">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentSearch[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search query for Convex
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Determine query types arg
  const typesArg = activeTab === "all" ? ["klienci", "zlecenia", "szanse", "zadania", "reklamacje"] : [activeTab];

  // Convex Query
  const searchResults = useQuery(
    api.search.querySearch,
    debouncedQuery.trim().length > 0
      ? { query: debouncedQuery, types: typesArg, limit: 30 }
      : "skip"
  );

  const isLoading = debouncedQuery.trim().length > 0 && searchResults === undefined;

  // Load recent searches on open
  useEffect(() => {
    if (isOpen) {
      setRecentItems(getRecentSearches());
      setFavoriteItems(getFavorites());
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selectedIndex when results or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults, activeTab, query]);

  // Items to display
  const items = searchResults || [];
  const totalItems = query.trim().length > 0 ? items.length : (favoriteItems.length + recentItems.length);

  // Handle Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        setActiveTab((prev) => {
          if (prev === "all") return "klienci";
          if (prev === "klienci") return "zlecenia";
          if (prev === "zlecenia") return "szanse";
          if (prev === "szanse") return "zadania";
          if (prev === "zadania") return "reklamacje";
          return "all";
        });
        return;
      }

      if (totalItems === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (query.trim().length > 0 && items[selectedIndex]) {
          handleSelectResult(items[selectedIndex]);
        } else if (query.trim().length === 0 && recentItems[selectedIndex]) {
          handleSelectResult(recentItems[selectedIndex]);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalItems, selectedIndex, items, recentItems, query, onClose, router]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  function handleSelectResult(item: {
    id: string;
    title: string;
    subtitle?: string;
    customText?: string;
    tags?: string[];
    type: "klienci" | "zlecenia" | "szanse" | "zadania" | "reklamacje";
    url: string;
  }) {
    saveRecentSearch({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      customText: item.customText,
      tags: item.tags,
      type: item.type,
      url: item.url,
      timestamp: Date.now(),
    });
    onClose();
    router.push(item.url);
  }

    const modalContent = (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div
        className="search-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header Input Area */}
        <div className="search-modal-header">
          <div className="search-input-icon">
            <Search size={18} />
          </div>

          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Szukaj klientów, numerów zleceń, telefonów, NIP..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery("")}
              title="Wyczyść"
            >
              ✕
            </button>
          )}

          <div className="search-shortcut-badge">Esc</div>
        </div>

        {/* Tab Filters & Quick Info */}
        <div className="search-modal-tabs">
          <div className="tab-buttons">
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              Wszystko
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "klienci" ? "active" : ""}`}
              onClick={() => setActiveTab("klienci")}
            >
              Klienci
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "zlecenia" ? "active" : ""}`}
              onClick={() => setActiveTab("zlecenia")}
            >
              Zlecenia
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "szanse" ? "active" : ""}`}
              onClick={() => setActiveTab("szanse")}
            >
              Szanse
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "zadania" ? "active" : ""}`}
              onClick={() => setActiveTab("zadania")}
            >
              Zadania
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "reklamacje" ? "active" : ""}`}
              onClick={() => setActiveTab("reklamacje")}
            >
              Reklamacje
            </button>
          </div>

          <div className="search-quick-hint">
            Użyj <code>k:</code> <code>z:</code> <code>s:</code> <code>zad:</code> <code>r:</code>
          </div>
        </div>

        {/* Results Body */}
        <div className="search-modal-body" ref={listRef}>
          {isLoading && (
            <div className="search-state-message">
              <div className="spinner" />
              <span>Wyszukiwanie...</span>
            </div>
          )}

          {!isLoading && query.trim().length > 0 && items.length === 0 && (
            <div className="search-state-message empty">
              <Search size={32} />
              <p>Brak wyników dla frazy „{query}”</p>
              <span>Spróbuj użyć innej frazy, telefonu lub NIPu</span>
            </div>
          )}

          {/* Active Search Results */}
          {!isLoading &&
            query.trim().length > 0 &&
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isClient = item.type === "klienci";
              const isSzanse = item.type === "szanse";
              const isZadania = item.type === "zadania";
              const isReklamacje = item.type === "reklamacje";
              
              const badgeClass = isClient ? "badge-quote" : isSzanse ? "badge-szanse" : isZadania ? "badge-zadania" : isReklamacje ? "badge-reklamacje" : "badge-order";
              const badgeLabel = isClient ? "KLIENT" : isSzanse ? "SZANSA" : isZadania ? "ZADANIE" : isReklamacje ? "REKLAMACJA" : "ZLECENIE";

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`search-result-row ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className={`search-type-badge ${badgeClass}`}
                  >
                    {badgeLabel}
                  </div>

                  <div className="search-row-content">
                    <div className="search-row-title-line">
                      <span className="search-row-title">{item.title}</span>
                      {item.status && (
                        <span
                          className={`search-status-tag status-${item.status.variant}`}
                        >
                          {item.status.label}
                        </span>
                      )}
                    </div>

                    {item.subtitle && (
                      <div className="search-row-subtitle">{item.subtitle}</div>
                    )}
                    
                    {item.customText && (
                      <div className="search-row-custom-text">
                        <span className="custom-text-badge">{item.customText}</span>
                      </div>
                    )}

                    {item.tags && item.tags.length > 0 && (
                      <div className="search-tags-row">
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="search-tag-chip">{tag}</span>
                        ))}
                      </div>
                    )}

                    {item.details && (
                      <div className="search-row-details">{item.details}</div>
                    )}
                  </div>

                  <button
                    className={`favorite-btn ${favoriteItems.some(f => f.id === item.id) ? "is-favorite" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteStorage({
                        id: item.id,
                        title: item.title,
                        subtitle: item.subtitle,
                        customText: item.customText,
                        tags: item.tags,
                        type: item.type,
                        url: item.url,
                        timestamp: Date.now()
                      });
                      setFavoriteItems(getFavorites());
                    }}
                    title="Dodaj do ulubionych"
                  >
                    <Star size={14} className={favoriteItems.some(f => f.id === item.id) ? "fill-current" : ""} />
                  </button>

                  <div className="search-row-arrow">→</div>
                </div>
              );
            })}

        {/* Empty state: Favorites & Recent */}
        {!query.trim() && (
          <div className="empty-state-lists">
            {favoriteItems.length > 0 && (
              <div className="recent-searches-wrapper favorites-wrapper">
                <div className="recent-header favorites-header">
                  <span>Ulubione</span>
                </div>

                {favoriteItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const isClient = item.type === "klienci";
                  const isSzanse = item.type === "szanse";
                  const isZadania = item.type === "zadania";
                  const isReklamacje = item.type === "reklamacje";

                  const badgeClass = isClient ? "badge-quote" : isSzanse ? "badge-szanse" : isZadania ? "badge-zadania" : isReklamacje ? "badge-reklamacje" : "badge-order";
                  const badgeLabel = isClient ? "KLIENT" : isSzanse ? "SZANSA" : isZadania ? "ZADANIE" : isReklamacje ? "REKLAMACJA" : "ZLECENIE";

                  return (
                    <div
                      key={`fav-${item.id}`}
                      className={`search-result-row ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={`search-type-badge ${badgeClass}`}>
                        {badgeLabel}
                      </div>

                      <div className="search-row-content">
                        <div className="search-row-title-line">
                          <span className="search-row-title">{item.title}</span>
                        </div>
                        {item.subtitle && (
                          <div className="search-row-subtitle">{item.subtitle}</div>
                        )}
                        {item.customText && (
                          <div className="search-row-custom-text">
                            <span className="custom-text-badge">{item.customText}</span>
                          </div>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div className="search-tags-row">
                            {item.tags.map((tag, idx) => (
                              <span key={idx} className="search-tag-chip">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        className="favorite-btn is-favorite"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteStorage(item);
                          setFavoriteItems(getFavorites());
                        }}
                        title="Usuń z ulubionych"
                      >
                        <Star size={14} className="fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {recentItems.length > 0 && (
              <div className="recent-searches-wrapper">
                <div className="recent-header">
                  <span>Ostatnio przeglądane</span>
                  <button
                    type="button"
                    className="clear-recent-btn"
                    onClick={() => {
                      clearRecentSearches();
                      setRecentItems([]);
                    }}
                  >
                    Wyczyść historię
                  </button>
                </div>

                {recentItems.map((item, index) => {
                  // Adjust index for keyboard navigation to continue after favorites
                  const actualIndex = favoriteItems.length + index;
                  const isSelected = actualIndex === selectedIndex;
                  const isClient = item.type === "klienci";
                  const isSzanse = item.type === "szanse";
                  const isZadania = item.type === "zadania";
                  const isReklamacje = item.type === "reklamacje";

                  const badgeClass = isClient ? "badge-quote" : isSzanse ? "badge-szanse" : isZadania ? "badge-zadania" : isReklamacje ? "badge-reklamacje" : "badge-order";
                  const badgeLabel = isClient ? "KLIENT" : isSzanse ? "SZANSA" : isZadania ? "ZADANIE" : isReklamacje ? "REKLAMACJA" : "ZLECENIE";

                  return (
                    <div
                      key={`recent-${item.id}`}
                      className={`search-result-row ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setSelectedIndex(actualIndex)}
                    >
                      <div className={`search-type-badge ${badgeClass}`}>
                        {badgeLabel}
                      </div>

                      <div className="search-row-content">
                        <div className="search-row-title-line">
                          <span className="search-row-title">{item.title}</span>
                        </div>
                        {item.subtitle && (
                          <div className="search-row-subtitle">{item.subtitle}</div>
                        )}
                        {item.customText && (
                          <div className="search-row-custom-text">
                            <span className="custom-text-badge">{item.customText}</span>
                          </div>
                        )}
                      </div>

                      <button
                        className={`favorite-btn ${favoriteItems.some(f => f.id === item.id) ? "is-favorite" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteStorage(item);
                          setFavoriteItems(getFavorites());
                        }}
                        title="Dodaj do ulubionych"
                      >
                        <Star size={14} className={favoriteItems.some(f => f.id === item.id) ? "fill-current" : ""} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {recentItems.length === 0 && favoriteItems.length === 0 && (
              <div className="search-state-message hint">
                <p>Zacznij pisać, aby wyszukać</p>
                <span>Szukaj po nazwisku, NIPie, nazwie zlecenia lub telefonie</span>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Footer info bar */}
        <div className="search-modal-footer">
          <div className="footer-keys">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Nawigacja</span>
            <span><kbd>↵</kbd> Wybierz</span>
            <span><kbd>Tab</kbd> Zmień typ</span>
            <span><kbd>Esc</kbd> Zamknij</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  if (typeof document !== "undefined") {
    const { createPortal } = require("react-dom");
    return createPortal(modalContent, document.body);
  }
  
  return null;
}
