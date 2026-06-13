"use client"

import InstallationCalendar from "../panel/InstallationCalendar"

export default function MontazPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <InstallationCalendar />
    </div>
  )
}
