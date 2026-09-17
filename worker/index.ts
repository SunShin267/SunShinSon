/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import type { ImageHandlers } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { Env } from "./env";
import { handleColoringApiRequest } from "./coloring-api";
import { handleGoogleDriveApiRequest } from "./google-drive-api";
import { handleApiRequest } from "./questions-api";
import { handleXiangqiApiRequest } from "./xiangqi-api";

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function preventDocumentCaching(request: Request, response: Response): Response {
  if (request.method !== "GET") return response;

  const contentType = response.headers.get("content-type") ?? "";
  const isDocument = request.headers.get("sec-fetch-dest") === "document"
    || contentType.includes("text/html")
    || contentType.includes("text/x-component")
    || request.headers.get("rsc") === "1";
  if (!isDocument) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const coloringApiResponse = await handleColoringApiRequest(request, env);
    if (coloringApiResponse) return coloringApiResponse;

    const googleDriveApiResponse = await handleGoogleDriveApiRequest(request, env);
    if (googleDriveApiResponse) return googleDriveApiResponse;

    const xiangqiApiResponse = await handleXiangqiApiRequest(request, env);
    if (xiangqiApiResponse) return xiangqiApiResponse;

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

    const response = await handler.fetch(request, env, ctx);
    return preventDocumentCaching(request, response);
  },
};

export default worker;
