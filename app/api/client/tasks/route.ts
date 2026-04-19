import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyAiWorkerWake } from "@/lib/queues/aiWorkerWakeQueue";
import { isClientApiKeyValid, isUuid } from "@/lib/clients/clientApiAuth";

type TaskType =
  | "COMPLIANCE_TASK"
  | "BOOKKEEPING_TASK"
  | "DOCUMENT_PROCESSING"
  | "JOB_DISCOVERY"
  | "JOB_MATCHING"
  | "JOB_APPLICATION";

type JsonDocumentInput =
  | string
  | {
      name?: string;
      file_name?: string;
      content_base64?: string;
      content_type?: string;
    };

type StoredDocument = {
  original_name: string;
  storage_path: string;
  bucket: string;
};

const ALLOWED_TASK_TYPES = new Set<TaskType>([
  "COMPLIANCE_TASK",
  "BOOKKEEPING_TASK",
  "DOCUMENT_PROCESSING",
  "JOB_DISCOVERY",
  "JOB_MATCHING",
  "JOB_APPLICATION",
]);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function estimateCompletionIso(priority: number) {
  const boundedPriority = Math.max(0, Math.min(10, priority));
  const minutesToComplete = Math.max(5, 40 - boundedPriority * 3);
  return new Date(Date.now() + minutesToComplete * 60 * 1000).toISOString();
}

async function uploadDocuments(
  taskId: string,
  clientId: string,
  documents: JsonDocumentInput[]
): Promise<StoredDocument[]> {
  const bucket = process.env.CLIENT_TASKS_BUCKET || "client-documents";
  const uploaded: StoredDocument[] = [];

  for (let index = 0; index < documents.length; index += 1) {
    const item = documents[index];
    const rawName = typeof item === "string" ? item : item.file_name || item.name || `document-${index + 1}.txt`;
    const fileName = sanitizeFileName(rawName);
    const storagePath = `client-tasks/${clientId}/${taskId}/${Date.now()}-${index}-${fileName}`;

    let content: string | Buffer = "";
    let contentType = "text/plain";

    if (typeof item === "string") {
      content = `Document reference received: ${item}`;
      contentType = "text/plain";
    } else if (item.content_base64) {
      content = Buffer.from(item.content_base64, "base64");
      contentType = item.content_type || "application/octet-stream";
    } else {
      content = JSON.stringify(item);
      contentType = "application/json";
    }

    const { error } = await supabaseServer.storage.from(bucket).upload(storagePath, content, {
      contentType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Failed to upload ${rawName}: ${error.message}`);
    }

    uploaded.push({
      original_name: rawName,
      storage_path: storagePath,
      bucket,
    });
  }

  return uploaded;
}

export async function POST(request: Request) {
  if (!isClientApiKeyValid(request)) {
    return NextResponse.json({ error: "Invalid client API key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const clientId = String(body.client_id || "").trim();
  const taskType = String(body.task_type || "").trim().toUpperCase() as TaskType;
  const country = String(body.country || "").trim();
  const currency = String(body.currency || "USD").trim().toUpperCase();
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;
  const documents = Array.isArray(body.documents) ? (body.documents as JsonDocumentInput[]) : [];

  if (!clientId || !isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a valid uuid" }, { status: 400 });
  }

  if (!ALLOWED_TASK_TYPES.has(taskType)) {
    return NextResponse.json({ error: "task_type is not supported" }, { status: 400 });
  }

  if (documents.length === 0) {
    return NextResponse.json({ error: "documents is required" }, { status: 400 });
  }

  const taskId = randomUUID();
  const estimatedCompletion = estimateCompletionIso(priority);

  try {
    const storedDocuments = await uploadDocuments(taskId, clientId, documents);

    const { error } = await supabaseServer.from("worker_tasks").insert({
      id: taskId,
      client_id: clientId,
      type: taskType,
      task_type: taskType,
      status: "pending",
      priority,
      scheduled_at: new Date().toISOString(),
      payload: {
        client_id: clientId,
        country,
        currency,
        priority,
        documents: storedDocuments.map((doc) => doc.storage_path),
        stored_documents: storedDocuments,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await notifyAiWorkerWake({
      taskId,
      taskType,
    });

    return NextResponse.json({
      status: "accepted",
      task_id: taskId,
      estimated_completion: estimatedCompletion,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process task",
      },
      { status: 500 }
    );
  }
}
