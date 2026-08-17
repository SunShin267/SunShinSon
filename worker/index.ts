/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import type { ImageHandlers } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { Env } from "./env";
import { handleApiRequest } from "./questions-api";

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const apiResponse = await handleApiRequest(request, env, ctx);
    if (apiResponse) return apiResponse;

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const images = env.IMAGES;
      const imageHandlers: ImageHandlers = {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
      };
      if (images) {
        imageHandlers.transformImage = async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        };
      }

      return handleImageOptimization(request, imageHandlers, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
