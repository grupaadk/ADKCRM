"use client";

import ScheduleGantt from "./ScheduleGantt";

export default function HarmonogramPage() {
  return (
    <div className="h-[calc(100vh-64px)] -m-5 -mb-10 p-3 flex flex-col overflow-hidden">
      <ScheduleGantt />
    </div>
  );
}
