"use client";

import dynamic from "next/dynamic";

const TUIMobileCalendarWrapper = dynamic(
  () => import("./TUIMobileCalendar"),
  { ssr: false, loading: () => <div className="h-[700px] flex items-center justify-center text-slate-400">Ładowanie kalendarza...</div> }
);

export default TUIMobileCalendarWrapper;
