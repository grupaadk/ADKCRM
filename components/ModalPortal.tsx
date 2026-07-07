"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Renders children into document.body via a React portal.
 * This ensures modals with `fixed inset-0` positioning are not
 * clipped by parent containers that have `overflow: auto/hidden`.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
