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
    const orders = await client.query("orders:listForPicker" as any, {});
    const targetOrder = orders.find((o: any) => o._id === "k57eqm52k18mg4dw68m9633vqn8cb23c");
    console.log("Order found:", targetOrder ? targetOrder.name : "No");

  } catch (e) {
    console.error(e);
  }
}

run();
