/**
 * Vox Ollama Client
 * MConnect vox integration
 *
 * Translates natural language to shell commands via local Ollama inference.
 */

export const DEFAULT_MODEL = 'qwen2.5-coder:0.5b';
export const DEFAULT_API_URL = 'http://localhost:11434';

const SYSTEM_PROMPT =
  'You are an expert shell programmer on {platform}. ' +
  'Given a natural language request, output ONLY the corresponding shell command. ' +
  'No explanations, no markdown, no code fences, no comments. Just the raw command.';

export interface OllamaClientOptions {
  model?: string;
  apiUrl?: string;
  temperature?: number;
}

export type OllamaStatus = 'ready' | 'no_model' | 'no_ollama';

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

/**
 * Return the current platform string for the system prompt.
 */
export function getPlatform(): 'macOS' | 'Linux' | 'Windows' {
  switch (process.platform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    default:
      return 'Linux';
  }
}

/**
 * Strip common LLM artifacts: code fences, backticks, prompt prefixes, leading comments.
 */
export function cleanResponse(text: string): string {
  let t = text.trim();

  // Strip opening code fence: ```bash / ```sh / ```shell / ```zsh or plain ```
  t = t.replace(/^```(?:bash|sh|shell|zsh)?\n?/, '');
  // Strip closing code fence
  t = t.replace(/\n?```$/, '');

  // Strip single-backtick wrapping: `command`
  if (t.startsWith('`') && t.endsWith('`') && t.indexOf('`', 1) === t.length - 1) {
    t = t.slice(1, -1);
  }

  // Strip shell prompt prefixes: $ or >
  t = t.replace(/^[$>]\s*/, '');

  // Strip "Here is the command:" style prefixes
  t = t.replace(/^(?:here (?:is|are) (?:the )?(?:command|script)s?:?\s*\n?)/i, '');

  // Strip leading comment lines
  const lines = t.trim().split('\n');
  while (lines.length > 0 && lines[0].trimStart().startsWith('#')) {
    lines.shift();
  }

  return lines.join('\n').trim();
}

/**
 * HTTP client for the local Ollama inference server.
 */
export class OllamaClient {
  private readonly model: string;
  private readonly apiUrl: string;
  private readonly temperature: number;

  constructor(options: OllamaClientOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.temperature = options.temperature ?? 0.1;
  }

  /**
   * Translate a natural-language query into a shell command.
   * Returns null on error or if Ollama is unreachable.
   */
  async translate(query: string): Promise<string | null> {
    const platform = getPlatform();
    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{platform}', platform) },
        { role: 'user', content: query },
      ],
      stream: false,
      options: {
        temperature: this.temperature,
        num_predict: 256,
      },
    };

    try {
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 404) {
        // Model not found
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OllamaChatResponse;
      const raw = data?.message?.content ?? '';
      const cmd = cleanResponse(raw);

      if (!cmd) return null;

      // Guard against runaway multi-KB responses
      if (cmd.length > 1000) return null;

      return cmd;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Timeout
        return null;
      }
      // Network / connection error → treat as no_ollama
      return null;
    }
  }

  /**
   * Check whether Ollama is running and the configured model is present.
   */
  async check(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) return 'no_ollama';

      const data = (await response.json()) as OllamaTagsResponse;
      const models = (data.models ?? []).map((m) => m.name);
      const modelName = this.model;

      const found = models.some(
        (m) => m === modelName || m.startsWith(`${modelName}:`)
      );

      return found ? 'ready' : 'no_model';
    } catch {
      return 'no_ollama';
    }
  }
}
