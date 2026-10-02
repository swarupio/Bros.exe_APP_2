import { currentUser, getAccessToken } from "../components/supabase-auth";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1`).replace(/\/$/, "");

const messages: Record<string, string> = {
  DATABASE_NOT_CONFIGURED: "Case saving is not connected yet. Your entered text is kept on this device.",
  STALE_CASE: "This case changed on another device. Reload and review the latest facts.",
  DRAFT_CONFLICT: "Another edit was saved first. Your text is preserved below; load the saved version before deciding what to keep.",
  FACTS_NOT_CONFIRMED: "Confirm at least one fact before preparing a plan or draft.",
  FACT_CONFLICT: "Choose one value or mark it unknown for each conflicting fact.",
  UNAUTHENTICATED: "Sign in to continue.",
  UNSAFE_DIRECT_CONTACT: "Use a consultation summary when direct contact may be unsafe.",
  STORAGE_CLEANUP_PENDING: "The case is hidden. File cleanup is pending; retry deletion when the service is available.",
};
export class ApiRequestError extends Error {
  constructor(public code: string, public status: number, message?: string) { super(messages[code] ?? message ?? "Could not complete the request. Try again."); }
}
export async function apiRequest<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const userId = currentUser()?.id;
  const token = await getAccessToken();
  if (!token || !userId || currentUser()?.id !== userId) throw new ApiRequestError("UNAUTHENTICATED", 401);
  const response = await fetch(`${API_BASE}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json();
  if (currentUser()?.id !== userId) throw new ApiRequestError("UNAUTHENTICATED", 401);
  if (!response.ok) throw new ApiRequestError(result.error?.code ?? "REQUEST_FAILED", response.status, result.error?.message);
  return result as T;
}
// StrictMode and rapid remounts share a pending generation rather than racing writes.
const pendingWorkflows=new Map<string,Promise<unknown>>();
export function apiWorkflowRequest<T>(path:string,body:Record<string,unknown>,revision?:number):Promise<T> {
  const key=JSON.stringify([currentUser()?.id,path,body,revision]);
  const prior=pendingWorkflows.get(key);
  if (prior) return prior as Promise<T>;
  const request=apiRequest<T>(path,{...body,request_id:crypto.randomUUID()}).finally(() => {pendingWorkflows.delete(key);});
  pendingWorkflows.set(key,request);
  return request;
}
