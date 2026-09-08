"use client";

import UniversalCalendar from "./UniversalCalendar";

export default function KalendarzPage() {
  return (
    <div className="h-[calc(100vh-64px)] -m-5 -mb-10 p-3 flex flex-col overflow-hidden">
      <UniversalCalendar />
    </div>
  );
}
