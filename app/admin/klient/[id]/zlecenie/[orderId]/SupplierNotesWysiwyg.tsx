"use client";

import { useEffect, useRef } from "react";

type SupplierNotesWysiwygProps = Readonly<{
  value: string;
  onChange: (nextText: string) => void;
  placeholder?: string;
}>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToHtml(text: string): string {
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      htmlParts.push("</ol>");
      inOl = false;
    }
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^•\s+(.*)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (inOl) {
        htmlParts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push("<ul>");
        inUl = true;
      }
      htmlParts.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
    } else if (orderedMatch) {
      if (inUl) {
        htmlParts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push("<ol>");
        inOl = true;
      }
      htmlParts.push(`<li>${escapeHtml(orderedMatch[1])}</li>`);
    } else {
      closeLists();
      htmlParts.push(line ? `<div>${escapeHtml(line)}</div>` : "<div><br></div>");
    }
  }

  closeLists();
  return htmlParts.join("");
}

function domToReadableText(root: HTMLElement): string {
  const lines: string[] = [];

  const extractInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    if (el.tagName === "BR") return "\n";
    let out = "";
    el.childNodes.forEach((child) => {
      out += extractInline(child);
    });
    return out;
  };

  const walkBlocks = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? "";
      if (txt) lines.push(txt);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "UL") {
      el.querySelectorAll(":scope > li").forEach((li) => {
        const txt = extractInline(li).trim();
        if (txt) lines.push(`• ${txt}`);
      });
      return;
    }

    if (tag === "OL") {
      let idx = 1;
      el.querySelectorAll(":scope > li").forEach((li) => {
        const txt = extractInline(li).trim();
        if (txt) {
          lines.push(`${idx}. ${txt}`);
          idx += 1;
        }
      });
      return;
    }

    if (tag === "DIV" || tag === "P" || tag === "LI") {
      const hasNestedBlock = Array.from(el.children).some((c) =>
        ["DIV", "P", "UL", "OL"].includes(c.tagName),
      );
      if (hasNestedBlock) {
        el.childNodes.forEach(walkBlocks);
      } else {
        const txt = extractInline(el).replace(/\n+$/, "");
        lines.push(txt);
      }
      return;
    }

    if (tag === "BR") {
      lines.push("");
      return;
    }

    lines.push(extractInline(el));
  };

  root.childNodes.forEach(walkBlocks);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function SupplierNotesWysiwyg({
  value,
  onChange,
  placeholder = "Wpisz treść uwagi lub wiadomości początkowej...",
}: SupplierNotesWysiwygProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const currentText = domToReadableText(el);
    if (currentText !== value.trim()) {
      el.innerHTML = plainTextToHtml(value);
    }
  }, [value]);

  function syncFromDom() {
    const el = editorRef.current;
    if (!el) return;
    const text = domToReadableText(el);
    onChange(text);
  }

  function execFormat(command: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false);
    syncFromDom();
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)] shadow-2xs">
      {/* Pasek narzędzi WYSIWYG */}
      <div className="flex items-center flex-wrap gap-1 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("bold");
          }}
          className="px-2 py-1 rounded text-xs font-bold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Pogrubienie (Ctrl+B)"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("italic");
          }}
          className="px-2 py-1 rounded text-xs italic font-serif font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Kursywa (Ctrl+I)"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("underline");
          }}
          className="px-2 py-1 rounded text-xs underline font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Podkreślenie (Ctrl+U)"
        >
          U
        </button>

        <span className="w-px h-4 bg-slate-300 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("insertUnorderedList");
          }}
          className="px-2 py-1 rounded text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Lista punktowana"
        >
          • Lista
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("insertOrderedList");
          }}
          className="px-2 py-1 rounded text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Lista numerowana"
        >
          1. Lista
        </button>

        <span className="w-px h-4 bg-slate-300 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat("removeFormat");
          }}
          className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors cursor-pointer"
          title="Wyczyść formatowanie"
        >
          Wyczyść format
        </button>
      </div>

      {/* Obszar edycji WYSIWYG */}
      <div className="relative">
        {!value.trim() && (
          <div className="pointer-events-none absolute top-3 left-3.5 text-xs text-slate-400 select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromDom}
          onBlur={syncFromDom}
          className="min-h-[160px] max-h-[320px] overflow-y-auto px-3.5 py-3 text-xs text-slate-900 leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        />
      </div>
    </div>
  );
}
