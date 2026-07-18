/** LLM provider abstraction. The platform is AI-first but never AI-dependent:
 *  every feature has a deterministic fallback so the product works (and is
 *  testable) without network access or API keys. */

export interface LLMProvider {
  readonly name: string;
  complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string>;
}

/** Calls the Anthropic Messages API directly (no SDK dependency). */
export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-5",
  ) {}

  async complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts?.maxTokens ?? 2048,
        ...(opts?.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  }
}

/** Resolve a provider from the environment; null means "template mode". */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LLMProvider | null {
  if (env.ANTHROPIC_API_KEY) return new ClaudeProvider(env.ANTHROPIC_API_KEY, env.PROPOS_LLM_MODEL);
  return null;
}
