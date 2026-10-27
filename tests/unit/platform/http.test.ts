import { beforeAll, describe, expect, test, vi } from "vitest";
import { z } from "zod";

beforeAll(() => {
  vi.stubEnv("AUTH_SECRET", "a".repeat(32));
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/gillu");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_SERVER_APP_URL", "http://localhost:3000");
  vi.stubEnv("LOG_LEVEL", "fatal");
});

const http = async () => ({
  ...(await import("~/platform/errors")),
  ...(await import("~/platform/http")),
});

describe("errorResponse", () => {
  test("AppError subclasses map to the error shape with the request id", async () => {
    const { ConflictError, errorResponse } = await http();
    const res = errorResponse(
      new ConflictError("slug_taken", "That shop URL is taken."),
      "req-12345678",
    );
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      error: { code: "slug_taken", message: "That shop URL is taken." },
      requestId: "req-12345678",
    });
  });

  test("subclasses carry their status and default code", async () => {
    const {
      ForbiddenError,
      NotFoundError,
      UnauthorizedError,
      ValidationError,
    } = await http();
    expect(new ValidationError()).toMatchObject({
      code: "validation_failed",
      status: 400,
    });
    expect(new UnauthorizedError()).toMatchObject({
      code: "unauthorized",
      message: "Sign in to continue.",
      status: 401,
    });
    expect(new ForbiddenError()).toMatchObject({
      code: "forbidden",
      status: 403,
    });
    expect(new NotFoundError()).toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  test("unknown errors become a generic 500 without leaking the message", async () => {
    const { errorResponse } = await http();
    const res = errorResponse(
      new Error("password=hunter2 at db"),
      "req-12345678",
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: unknown };
    expect(body.error).toEqual({
      code: "internal_error",
      message: "Something went wrong.",
    });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});

describe("parseJson", () => {
  const schema = z.object({ name: z.string().min(2) });

  test("rejects a body that is not JSON", async () => {
    const { parseJson } = await http();
    await expect(
      parseJson(
        new Request("http://x", { body: "nope", method: "POST" }),
        schema,
      ),
    ).rejects.toMatchObject({ code: "validation_failed", status: 400 });
  });

  test("reports field errors from the schema", async () => {
    const { parseJson } = await http();
    await expect(
      parseJson(
        new Request("http://x", {
          body: JSON.stringify({ name: "a" }),
          method: "POST",
        }),
        schema,
      ),
    ).rejects.toMatchObject({ details: { name: expect.any(Array) } });
  });

  test("nested field errors are also keyed by their dotted path", async () => {
    const { parseJson } = await http();
    const nested = z.object({
      variant: z.object({ price: z.number(), sku: z.string() }),
    });
    await expect(
      parseJson(
        new Request("http://x", {
          body: JSON.stringify({ variant: { sku: "A" } }),
          method: "POST",
        }),
        nested,
      ),
    ).rejects.toMatchObject({
      details: {
        variant: [expect.any(String)],
        "variant.price": [expect.any(String)],
      },
    });
  });

  test("returns the parsed value", async () => {
    const { parseJson } = await http();
    await expect(
      parseJson(
        new Request("http://x", {
          body: JSON.stringify({ name: "Asha" }),
          method: "POST",
        }),
        schema,
      ),
    ).resolves.toEqual({ name: "Asha" });
  });
});

describe("apiRoute", () => {
  test("uses the proxy's request id and converts thrown AppErrors", async () => {
    const { apiRoute, NotFoundError } = await http();
    const handler = apiRoute(() => Promise.reject(new NotFoundError()));
    const res = await handler(
      new Request("http://x", { headers: { "x-request-id": "abcdefgh1234" } }),
      {},
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { requestId: string }).requestId).toBe(
      "abcdefgh1234",
    );
  });

  test("ok wraps data and disables caching", async () => {
    const { ok } = await http();
    const res = ok({ id: "m1" }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { id: "m1" } });
  });
});

describe("parseQuery", () => {
  test("parses search params with a schema", async () => {
    const { parseQuery } = await http();
    const request = new Request("http://x.test/items?status=OPEN&q=diya");
    expect(
      parseQuery(
        request,
        z.object({ q: z.string(), status: z.enum(["OPEN"]) }),
      ),
    ).toEqual({ q: "diya", status: "OPEN" });
  });

  test("schema failures are a 400 naming the parameter", async () => {
    const { parseQuery } = await http();
    const request = new Request("http://x.test/items?status=SHUT");
    expect(() =>
      parseQuery(request, z.object({ status: z.enum(["OPEN"]) })),
    ).toThrow(
      expect.objectContaining({
        code: "validation_failed",
        details: { status: [expect.any(String)] },
        status: 400,
      }),
    );
  });
});
