import axios from "axios";
import type { ReminderFormErrors, ReminderFormState } from "./ReminderFormBody";

function getCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[\\.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export interface SubmitResult {
  success: boolean;
  errors?: ReminderFormErrors;
  message?: string;
}

export async function submitReminderForm(
  url: string,
  state: ReminderFormState
): Promise<SubmitResult> {
  const body = new URLSearchParams();
  body.append("name", state.name);
  body.append("note", state.note);
  body.append("is_active", state.is_active ? "true" : "false");
  body.append("create_todo", state.create_todo ? "true" : "false");
  body.append("schedule_type", state.schedule_type);
  if (state.trigger_time) body.append("trigger_time", state.trigger_time);
  body.append("days_of_week_input", JSON.stringify(state.days_of_week ?? []));
  body.append("days_of_month_input", JSON.stringify(state.days_of_month ?? []));
  if (state.start_at) {
    body.append("start_at", new Date(state.start_at).toISOString());
  }
  // Legacy fields kept happy with defaults; the form requires them present.
  body.append("interval_value", "1");
  body.append("interval_unit", "day");

  const csrf = getCookie("csrftoken");
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (csrf) headers["X-CSRFToken"] = csrf;

  try {
    const response = await axios.post(url, body, {
      headers,
      withCredentials: true,
    });
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, message: "Unexpected response from server." };
  } catch (err: any) {
    const data = err.response?.data;
    if (data?.errors) {
      return { success: false, errors: data.errors };
    }
    if (data && typeof data === "object") {
      const formErrors: ReminderFormErrors = {};
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) formErrors[key] = data[key];
      }
      if (Object.keys(formErrors).length > 0) {
        return { success: false, errors: formErrors };
      }
    }
    return {
      success: false,
      message: err.message || "Failed to save reminder.",
    };
  }
}

export async function submitDeleteReminder(url: string): Promise<SubmitResult> {
  const body = new URLSearchParams();
  const csrf = getCookie("csrftoken");
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (csrf) headers["X-CSRFToken"] = csrf;

  try {
    await axios.post(url, body, {
      headers,
      withCredentials: true,
    });
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to delete reminder.",
    };
  }
}
