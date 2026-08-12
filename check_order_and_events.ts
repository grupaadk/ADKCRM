import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.error("No NEXT_PUBLIC_CONVEX_URL found");
  process.exit(1);
}

const client = new ConvexHttpClient(url);

async function run() {
  try {
    const allLinkedEvents = await client.query("calendarEvents:getLinkedOrderEvents" as any, { startDate: 0, endDate: 9999999999999 });
    const complaintEvents = allLinkedEvents.filter((e: any) => e.complaintId === "ms74yj48epeengkhy8bzv45fy18cb2se");
    console.log("Complaint Event in linkedEvents:", JSON.stringify(complaintEvents, null, 2));
    
  } catch (e) {
    console.error(e);
  }
}

run();
