export declare function assertAllowedDataApiPath(resourcePath: string): void;
export declare function stripUndefined<T>(value: T): T;
export declare function redactSensitive(value: unknown): unknown;
export declare function approvalGate(approved: boolean | undefined, action: string): {
    ok: true;
    blocked?: undefined;
    approvalRequired?: undefined;
    action?: undefined;
    message?: undefined;
    approvalActions?: undefined;
} | {
    ok: false;
    blocked: boolean;
    approvalRequired: boolean;
    action: string;
    message: string;
    approvalActions: string[];
};
