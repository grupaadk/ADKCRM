"use client";

import UniversalCalendar from "./UniversalCalendar";

export default function KalendarzPage() {
  return (
    <div className="h-[calc(100vh-64px)] -mx-6 -mt-5 -mb-10 p-3 flex flex-col w-full flex-1 overflow-hidden">
      <UniversalCalendar />
    </div>
  );
}
