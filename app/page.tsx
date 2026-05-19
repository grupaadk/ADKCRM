"use client";

import Link from "next/link";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center flex flex-col gap-6 items-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-900">ADK</h1>
        <p className="text-slate-600">System zarzadzania klientami</p>

        <AuthLoading>
          <div className="text-sm text-slate-400">Ładowanie…</div>
        </AuthLoading>

        <Authenticated>
          <Link
            href="/admin"
            className="bg-slate-900 text-white px-8 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Przejdz do panelu
          </Link>
        </Authenticated>

        <Unauthenticated>
          <Link
            href="/login"
            className="bg-slate-900 text-white px-8 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Zaloguj sie
          </Link>
        </Unauthenticated>
      </div>
    </div>
  );
}
