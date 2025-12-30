import axios from "axios";

// EventBus for React (using tiny-emitter like Vue version)
import emitter from "tiny-emitter/instance";

export const EventBus = {
  $on: (...args: any[]) => emitter.on(...args),
  $once: (...args: any[]) => emitter.once(...args),
  $off: (...args: any[]) => emitter.off(...args),
  $emit: (...args: any[]) => emitter.emit(...args),
};

// Configure axios to use CSRF token from cookies (matching Vue bundle behavior)
// NOTE: We're manually setting CSRF headers in doPost, so we should NOT use axios defaults
// to avoid double-adding the token. Axios defaults would add X-CSRFToken (from xsrfHeaderName),
// but we're manually adding X-Csrftoken, which could cause issues.
// Let's disable axios defaults for CSRF to avoid conflicts:
// axios.defaults.xsrfCookieName = "csrftoken";
// axios.defaults.xsrfHeaderName = "X-CSRFToken"; // Django's default CSRF header name
axios.defaults.withCredentials = true; // Ensure cookies are sent

// Helper function to get CSRF token from cookies or BASE_TEMPLATE_DATA
function getCsrfToken(): string {
  // First try to get from BASE_TEMPLATE_DATA (set by Django template)
  if (typeof window !== "undefined" && (window as any).BASE_TEMPLATE_DATA?.csrfToken) {
    const token = (window as any).BASE_TEMPLATE_DATA.csrfToken;
    if (token && token.trim() !== "") {
      return token.trim();
    }
  }
  // Fallback: try to get from cookies using a more robust cookie parser
  const name = "csrftoken";
  if (typeof document !== "undefined" && document.cookie) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const token = parts.pop()?.split(";").shift();
      if (token) {
        return decodeURIComponent(token);
      }
    }
  }
  return "";
}

/**
 * Use axios to perform an HTTP GET call.
 * @param {string} url The url to request.
 * @param {Function} callback An optional callback function.
 * @param {string} errorMsg The message to display on error.
 */
export function doGet(url: string, callback: (response: any) => void, errorMsg = "", responseType: "json" | "text" = "json") {
  axios
    .get(url, { responseType: responseType })
    .then((response) => {
      if (response.data.status && response.data.status !== "OK") {
        EventBus.$emit("toast", {
          title: "Error!",
          body: errorMsg,
          variant: "danger",
          autoHide: true,
        });
        console.log(errorMsg);
      } else {
        return callback(response);
      }
    })
    .catch((error) => {
      EventBus.$emit("toast", {
        title: "Error!",
        body: `${errorMsg}: ${error.message}`,
        variant: "danger",
        autoHide: true,
      });
      console.error(error);
    });
}

/**
 * Use axios to perform an HTTP POST call.
 * @param {string} url The url to request.
 * @param {object} params The parameters for the POST body.
 * @param {Function} callback An optional callback function.
 * @param {string} successMsg The message to display on success.
 * @param {string} errorMsg The message to display on error.
 */
export function doPost(url: string, params: Record<string, any>, callback: (response: any) => void, successMsg = "", errorMsg = "") {
  const bodyFormData = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    bodyFormData.append(key, value as string);
  }

  // Get CSRF token and manually set header
  // Note: Django accepts both X-CSRFToken and X-Csrftoken (case-insensitive)
  const csrfToken = getCsrfToken();
  
  const headers: Record<string, string> = {};
  if (csrfToken) {
    // Use X-Csrftoken to match ChatBot component convention
    headers["X-Csrftoken"] = csrfToken;
  }
  
  // Match Vue version: use axios() directly, ensure credentials are sent
  axios(url, {
    method: "POST",
    data: bodyFormData,
    headers: headers,
    withCredentials: true, // Ensure cookies are sent for same-origin requests
  }).then((response) => {
    if (response.data.status && response.data.status === "Warning") {
        EventBus.$emit("toast", {
          title: "Error",
          body: response.data.message,
          variant: "warning",
          autoHide: true,
        });
        console.log("Warning: ", response.data.message);
      } else if (response.data.status && response.data.status !== "OK") {
        EventBus.$emit("toast", {
          title: "Error",
          body: response.data.message,
          variant: "danger",
          autoHide: true,
        });
        console.log("Error: ", response.data.message);
      } else {
        const body = response.data.message ? response.data.message : successMsg;
        if (body) {
          EventBus.$emit("toast", {
            title: "Success",
            body: response.data.message ? response.data.message : successMsg,
            variant: "info",
          });
        }
        callback(response);
      }
    })
    .catch((error) => {
      EventBus.$emit("toast", {
        title: "Error",
        body: error.response?.data?.message || error.message,
        variant: "danger",
        autoHide: true,
      });
      console.error(error);
    });
}

