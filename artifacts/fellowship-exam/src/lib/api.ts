const API_BASE = "/api";

export type Role =
  | "super_admin"
  | "program_admin"
  | "central_exam_coordinator"
  | "exam_coordinator"
  | "unit_coordinator"
  | "doctor"
  | "student";

export interface User {
  id: number;
  email: string;
  salutation: string | null;
  fullName: string;
  employeeId: string | null;
  designation: string | null;
  gender: string | null;
  avatarSeed: string | null;
  role: Role;
  unitId: number | null;
  unitName: string | null;
  programId: number | null;
  forcePasswordReset: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body.error || body.message || "API Error");
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("fellowship_token");
}

export function setToken(token: string): void {
  localStorage.setItem("fellowship_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("fellowship_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getBlob: (path: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { headers }).then(res => {
      if (!res.ok) throw new Error("Failed to download");
      return res.blob();
    });
  },
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  delete_body: <T>(path: string, body: unknown) => request<T>(path, { method: "DELETE", body: JSON.stringify(body) }),
};
