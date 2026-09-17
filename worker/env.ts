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
  COLORING_AI_PROXY_URL?: string;
  COLORING_AI_PROXY_SECRET?: string;
  POLLINATIONS_API_KEY?: string;
  POLLINATIONS_IMAGE_MODEL?: string;
  POLLINATIONS_TEXT_MODEL?: string;
  GOOGLE_DRIVE_CLIENT_ID?: string;
  GOOGLE_DRIVE_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_TOKEN_KEY?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
