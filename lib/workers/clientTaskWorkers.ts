import { logEvent } from "@/lib/system/logging";

type GenericTaskPayload = Record<string, unknown>;

export async function runBookkeepingWorker(payload: GenericTaskPayload) {
  logEvent({
    type: "bookkeeping_task_received",
    payload,
  });

  return {
    status: "accepted",
    worker: "bookkeeping",
  };
}

export async function runDocProcessingWorker(payload: GenericTaskPayload) {
  logEvent({
    type: "document_processing_task_received",
    payload,
  });

  return {
    status: "accepted",
    worker: "document-processing",
  };
}
