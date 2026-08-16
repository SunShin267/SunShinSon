export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
  headers?: HeadersInit,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(fields === undefined ? {} : { fields }),
    },
  };

  return jsonResponse(body, status, headers);
}
