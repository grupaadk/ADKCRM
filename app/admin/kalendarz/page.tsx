"use client";

import UniversalCalendar from "./UniversalCalendar";

export default function KalendarzPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <UniversalCalendar />
    </div>
  );
}
