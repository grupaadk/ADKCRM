import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function run() {
  const allClients = await client.query("clients:getAll");
  const irminaClient = allClients.find(c => c.firstName?.toLowerCase().includes("irmina") || c.lastName?.toLowerCase().includes("irmina"));
  console.log("Irmina client:", irminaClient);
}

run().catch(console.error);
