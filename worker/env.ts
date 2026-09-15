export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  LOGIN_ATTEMPT_SALT: string;
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  CLOUDFLARE_AI_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_API_TOKEN?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
