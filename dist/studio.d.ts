export declare function buildLivePlan(params: {
    goal: "schedule" | "update" | "go_live" | "end_live" | "chat_moderation" | "status_check";
    title?: string;
    notes?: string;
}): {
    goal: "schedule" | "update" | "go_live" | "end_live" | "chat_moderation" | "status_check";
    title: string | null;
    plan: string[];
    approvalRequiredBefore: string[];
    notes: string;
};
export declare function studioCapabilities(): {
    apiBacked: string[];
    notApiBacked: string[];
    safety: string[];
};
