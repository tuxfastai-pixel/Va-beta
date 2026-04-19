import { config as loadEnv } from "dotenv";
import { runClientAcquisition } from "./outreachWorker.ts";

loadEnv({ path: ".env.local" });

async function run() {
  await runClientAcquisition();
}

void run();

setInterval(() => {
  void run();
}, 3 * 60 * 60 * 1000);

console.log("Outreach worker runner active...");
