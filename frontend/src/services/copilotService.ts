export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface CopilotResponse {
  reply: string;
  suggestions: string[];
  model: string;
}

export interface CopilotStatus {
  status: string;
  name: string;
  model: string;
  role: string;
}

const BASE_URL = "/api/copilot";

export async function getCopilotStatus(): Promise<CopilotStatus> {
  const response = await fetch(`${BASE_URL}/status`);
  if (!response.ok) {
    throw new Error(`Copilot status check failed: ${response.status}`);
  }
  return response.json();
}

export async function sendCopilotChat(
  messages: CopilotMessage[],
  context?: Record<string, unknown>,
): Promise<CopilotResponse> {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context: context || null,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData.detail || `Copilot communication error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}