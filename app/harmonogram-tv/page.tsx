"use client";

import { ReactNode, useEffect } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import ScheduleGantt from "@/app/admin/harmonogram/ScheduleGantt";

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

export default function HarmonogramTvPage() {
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
          <div className="h-screen w-screen overflow-hidden flex flex-col">
            <ScheduleGantt tvMode />
          </div>
        </AccessGuard>
      </Authenticated>
    </>
  );
}
