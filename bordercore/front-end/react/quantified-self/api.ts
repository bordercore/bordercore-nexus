import axios from "axios";
import { getCsrfToken } from "../utils/reactUtils";
export async function api<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await axios({
    url,
    method,
    data,
    headers: { "X-CSRFToken": getCsrfToken() },
    withCredentials: true,
  });
  return response.data as T;
}
export function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === "string" ? detail : "Unable to save or load data. Please try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function daysBefore(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}
