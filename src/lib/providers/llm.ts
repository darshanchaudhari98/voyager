import OpenAI from "openai";

export function llmModel(): string {
  return process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
}

export function llmConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function llmClient(agentLabel: string): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      `OPENAI_API_KEY is not configured. The ${agentLabel} requires an LLM key.`
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://ai-travel-control-plane.vercel.app",
      "X-Title": "AI Travel Agent Control Plane",
    },
  });
}

/**
 * Run a strict-JSON chat completion and parse the result. Throws on an empty or
 * invalid response so the caller (an agent) can decide how to handle it.
 */
export async function chatJSON<T>(
  agentLabel: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.6
): Promise<T> {
  const completion = await llmClient(agentLabel).chat.completions.create({
    model: llmModel(),
    response_format: { type: "json_object" },
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error(`${agentLabel} returned an empty response.`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${agentLabel} returned invalid JSON.`);
  }
}
