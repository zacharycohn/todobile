import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

import { AppError, isAppError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    { data, error: null },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export function fail(error: AppError) {
  return NextResponse.json(
    {
      data: null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? {}
      }
    },
    {
      status: error.status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError("validation_failed", "Request validation failed", 400, {
      issues: result.error.flatten()
    });
  }
  return result.data;
}

export async function withRouteErrorHandling<T>(handler: () => Promise<NextResponse<T>>) {
  try {
    return await handler();
  } catch (error) {
    if (isAppError(error)) {
      return fail(error);
    }

    console.error(error);
    return fail(new AppError("internal_error", "Unexpected server error", 500));
  }
}
