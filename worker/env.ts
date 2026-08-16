export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  LOGIN_ATTEMPT_SALT: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
