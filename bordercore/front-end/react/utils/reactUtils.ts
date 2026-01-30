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
axios.defaults.xsrfCookieName = "csrftoken";
axios.defaults.xsrfHeaderName = "X-CSRFToken";
axios.defaults.withCredentials = true; // Ensure cookies are sent

// Helper function to get CSRF token from cookie
// Django validates the header token against the cookie token, so we must use the cookie value
function getCsrfToken(): string {
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
 * @param {string} responseType The response type (json, text, or arraybuffer).
 */
export function doGet(url: string, callback: (response: any) => void, errorMsg = "", responseType: "json" | "text" | "arraybuffer" = "json") {
  axios
    .get(url, { responseType: responseType })
    .then((response) => {
      // Skip status check for arraybuffer responses (binary data has no .status property)
      if (responseType !== "arraybuffer" && response.data.status && response.data.status !== "OK") {
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
export function doPost(url: string, params: Record<string, any>, callback: (response: any) => void, successMsg = "", errorMsg = ""): void {
  const bodyFormData = new URLSearchParams();

  // Get CSRF token first so we can add it to form data
  const csrfToken = getCsrfToken();

  // Add CSRF token to form data as fallback (Django accepts both header and form field)
  if (csrfToken) {
    bodyFormData.append("csrfmiddlewaretoken", csrfToken);
  }

  for (const [key, value] of Object.entries(params)) {
    bodyFormData.append(key, value as string);
  }

  const headers: Record<string, string> = {};
  if (csrfToken) {
    // Also set header (Django accepts both X-CSRFToken and X-Csrftoken, case-insensitive)
    headers["X-CSRFToken"] = csrfToken;
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

/**
 * Use axios to perform an HTTP PUT call.
 * @param {string} url The url to request.
 * @param {object} params The parameters for the PUT body.
 * @param {Function} callback An optional callback function.
 * @param {string} successMsg The message to display on success.
 * @param {string} errorMsg The message to display on error.
 */
export function doPut(url: string, params: Record<string, any>, callback: (response: any) => void, successMsg = "", errorMsg = ""): void {
  const bodyFormData = new URLSearchParams();

  // Get CSRF token first so we can add it to form data
  const csrfToken = getCsrfToken();

  // Add CSRF token to form data as fallback
  if (csrfToken) {
    bodyFormData.append("csrfmiddlewaretoken", csrfToken);
  }

  for (const [key, value] of Object.entries(params)) {
    bodyFormData.append(key, value as string);
  }

  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  axios(url, {
    method: "PUT",
    data: bodyFormData,
    headers: headers,
    withCredentials: true,
  }).then((response) => {
    if (response.status !== 200) {
      EventBus.$emit("toast", {
        title: "Error",
        body: response.data.message,
        variant: "danger",
        autoHide: true,
      });
      console.log("Error: ", response.statusText);
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
        body: error.message,
        variant: "danger",
        autoHide: true,
      });
      console.error(error);
    });
}

/**
 * Use axios to perform an HTTP DELETE call.
 * @param {string} url The url to request.
 * @param {Function} callback An optional callback function.
 * @param {string} successMsg The message to display on success.
 */
export function doDelete(url: string, callback: (response: any) => void, successMsg = ""): void {
  const csrfToken = getCsrfToken();

  // Create form data with CSRF token
  const bodyFormData = new URLSearchParams();
  if (csrfToken) {
    bodyFormData.append("csrfmiddlewaretoken", csrfToken);
  }

  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  axios(url, {
    method: "DELETE",
    data: bodyFormData,
    headers: headers,
    withCredentials: true,
  }).then((response) => {
    if (successMsg) {
      EventBus.$emit("toast", {
        body: successMsg,
        variant: "info",
      });
    }
    callback(response);
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