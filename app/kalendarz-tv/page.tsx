"use client";

import { ReactNode, useEffect } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import QuarterlyTvCalendar from "./QuarterlyTvCalendar";

function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "var(--background)" }}
    />
  );
}

function AccessGuard({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const router = useRouter();

  useEffect(() => {
    if (me === null) {
      router.replace("/brak-dostepu");
    }
  }, [me, router]);

  if (me === undefined || me === null) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--background)" }}
      />
    );
  }

  return <>{children}</>;
}

export default function KalendarzTvPage() {
  return (
    <>
      <AuthLoading>
        <div
          className="flex items-center justify-center min-h-screen"
          style={{ background: "var(--background)" }}
        />
      </AuthLoading>
      <Unauthenticated>
        <LoginRedirect />
      </Unauthenticated>
      <Authenticated>
        <AccessGuard>
          <QuarterlyTvCalendar />
        </AccessGuard>
      </Authenticated>
    </>
  );
}
