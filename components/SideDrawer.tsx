"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Wysuwany panel z prawej krawędzi, na całą wysokość strony.
 * Zawsze zamontowany — widoczność/animacja sterowana propem `open`
 * (transform + opacity z transition CSS), bez stanu w efektach.
 * Zamykany kliknięciem w tło, krzyżyk lub klawisz Escape.
 */
export default function SideDrawer({
  open,
  onClose,
  title,
  width = 460,
  children,
  footer,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}) {
  // Escape zamyka (subskrypcja zdarzenia — aktywna tylko gdy otwarty).
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
    >
      {/* tło */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/30 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      />
      {/* panel */}
      <div
        className="absolute right-0 top-0 flex h-full max-w-[92vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
        style={{ width, transform: open ? "translateX(0)" : "translateX(100%)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
          <div className="min-w-0 text-sm font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Zamknij"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className={`flex-1 ${bodyClassName ?? "overflow-y-auto"}`}>{children}</div>
        {footer && <div className="shrink-0 border-t border-gray-200 p-4">{footer}</div>}
      </div>
    </div>
  );
}
