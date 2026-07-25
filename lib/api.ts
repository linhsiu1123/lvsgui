import { NextResponse } from 'next/server';
import { BackendError } from './backend';

/**
 * Runs a backend proxy call inside a route handler and maps the result (or a
 * `BackendError`) to a `NextResponse`. Keeps every route handler a one-liner.
 */
export async function proxy<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? null);
  } catch (err) {
    if (err instanceof BackendError) {
      const body = err.body ?? { error: err.message };
      return NextResponse.json(body, { status: err.status });
    }
    console.error('Unexpected API error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/** Safely parse a JSON request body, returning `{}` when absent/invalid. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
