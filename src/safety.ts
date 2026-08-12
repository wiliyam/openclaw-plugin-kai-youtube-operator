import { APPROVAL_ACTIONS, SUPPORTED_DATA_API_PATHS } from "./constants.js";

export function assertAllowedDataApiPath(resourcePath: string): void {
  if (!/^[A-Za-z]+(?:\/[A-Za-z]+)?$/.test(resourcePath) || !SUPPORTED_DATA_API_PATHS.has(resourcePath)) {
    throw new Error(`Unsupported YouTube Data API path: ${resourcePath}`);
  }
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, stripUndefined(item)]);
  return Object.fromEntries(entries) as T;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== "object") return value;
  const secretKeys = new Set([
    "access_token",
    "refresh_token",
    "client_secret",
    "clientSecret",
    "streamKey",
    "streamName",
    "ingestionAddress",
    "backupIngestionAddress",
  ]);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    secretKeys.has(key) ? "[redacted]" : redactSensitive(item),
  ]));
}

export function approvalGate(approved: boolean | undefined, action: string) {
  if (approved) return { ok: true as const };
  return {
    ok: false as const,
    blocked: true,
    approvalRequired: true,
    action,
    message: `Explicit approval is required before ${action}. Call this tool again with approved: true only after the user approves the exact action.`,
    approvalActions: APPROVAL_ACTIONS,
  };
}
