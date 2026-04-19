"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Coś poszło nie tak
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Błąd został automatycznie zgłoszony. Możesz spróbować ponownie.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
