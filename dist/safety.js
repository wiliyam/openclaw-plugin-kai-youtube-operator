import { APPROVAL_ACTIONS, SUPPORTED_DATA_API_PATHS } from "./constants.js";
export function assertAllowedDataApiPath(resourcePath) {
    if (!/^[A-Za-z]+(?:\/[A-Za-z]+)?$/.test(resourcePath) || !SUPPORTED_DATA_API_PATHS.has(resourcePath)) {
        throw new Error(`Unsupported YouTube Data API path: ${resourcePath}`);
    }
}
export function stripUndefined(value) {
    if (Array.isArray(value))
        return value.map((item) => stripUndefined(item));
    if (!value || typeof value !== "object")
        return value;
    const entries = Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]);
    return Object.fromEntries(entries);
}
export function redactSensitive(value) {
    if (Array.isArray(value))
        return value.map((item) => redactSensitive(item));
    if (!value || typeof value !== "object")
        return value;
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
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        secretKeys.has(key) ? "[redacted]" : redactSensitive(item),
    ]));
}
export function approvalGate(approved, action) {
    if (approved)
        return { ok: true };
    return {
        ok: false,
        blocked: true,
        approvalRequired: true,
        action,
        message: `Explicit approval is required before ${action}. Call this tool again with approved: true only after the user approves the exact action.`,
        approvalActions: APPROVAL_ACTIONS,
    };
}
