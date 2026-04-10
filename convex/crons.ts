import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Google Drive health check",
  { minutes: 30 },
  internal.googleDrive.scheduledHealthCheck,
  {},
);

export default crons;
