const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://yourdomain.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type Job = {
  id: string;
  title?: string;
  company?: string;
  pay_amount?: number;
};

export async function fetchJobs(): Promise<Job[]> {
  return request<Job[]>("/api/jobs");
}

export async function fetchEarnings(userId: string): Promise<{ total: number; byCurrency?: Record<string, number> }> {
  return request<{ total: number; byCurrency?: Record<string, number> }>(`/api/earnings?user_id=${encodeURIComponent(userId)}`);
}

export async function autoApply(payload: { userId: string }): Promise<{ status: string }> {
  return request<{ status: string }>("/api/jobs/auto-apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendVoiceCommand(command: string): Promise<{ action: string; message: string }> {
  return request<{ action: string; message: string }>("/api/voice/command", {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export async function getUserMode(userId: string): Promise<{ mode: "assist" | "autonomous" }> {
  return request<{ mode: "assist" | "autonomous" }>(`/api/user/mode?userId=${encodeURIComponent(userId)}`);
}

export async function setUserMode(userId: string, mode: "assist" | "autonomous") {
  return request<{ ok: boolean; mode: "assist" | "autonomous" }>("/api/user/mode", {
    method: "POST",
    body: JSON.stringify({ userId, mode }),
  });
}

export type VoicePipelineResponse = {
  text: string;
  action: string;
  reply: string;
  metadata?: Record<string, unknown>;
  ttsBase64: string | null;
  ttsMimeType: string;
  audio?: string | null;
};

export async function sendVoiceAudio(uri: string, userId?: string): Promise<VoicePipelineResponse> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  if (userId) {
    formData.append("userId", userId);
  }

  const response = await fetch(`${API_BASE_URL}/api/voice`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Voice request failed with status ${response.status}`);
  }

  return response.json() as Promise<VoicePipelineResponse>;
}
