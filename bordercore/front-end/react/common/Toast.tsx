import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle, faQuestion, faTimes } from "@fortawesome/free-solid-svg-icons";

const DEFAULT_DELAY_MS = 5000;

interface ToastMessage {
  title?: string;
  body: string;
  variant?: "info" | "danger" | "warning" | "success";
  autoHide?: boolean;
  delay?: number;
}

interface ToastProps {
  initialMessages?: ToastMessage[];
  defaultVariant?: "info" | "danger" | "warning" | "success";
}

export function Toast({ initialMessages = [], defaultVariant = "info" }: ToastProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("Toast Body");
  const [variant, setVariant] = useState<"info" | "danger" | "warning" | "success">(defaultVariant);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getIcon = () => {
    if (variant === "danger") {
      return faExclamationTriangle;
    } else if (variant === "warning") {
      return faQuestion;
    } else {
      return faCheck;
    }
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const hide = () => {
    clearHideTimer();
    setVisible(false);
  };

  const showToast = (payload: ToastMessage) => {
    const newVariant = payload.variant !== undefined ? payload.variant : defaultVariant;
    setVariant(newVariant);
    if (payload.title !== undefined) {
      setTitle(payload.title);
    } else {
      setTitle(newVariant.charAt(0).toUpperCase() + newVariant.slice(1));
    }
    setBody(payload.body);
    setVisible(true);

    clearHideTimer();
    // autoHide defaults to true; only an explicit `false` suppresses the timer.
    const shouldAutoHide = payload.autoHide !== false;
    if (shouldAutoHide) {
      const delay = payload.delay ?? DEFAULT_DELAY_MS;
      hideTimerRef.current = setTimeout(() => setVisible(false), delay);
    }
  };

  useEffect(() => {
    if (window.EventBus) {
      const handler = (payload: ToastMessage) => {
        showToast(payload);
      };
      window.EventBus.$on("toast", handler);

      // Show initial messages
      initialMessages.forEach(message => {
        showToast(message);
      });

      return () => {
        window.EventBus.$off("toast", handler);
        clearHideTimer();
      };
    }
  }, []);

  return (
    <div className={`toast-wrapper fixed top-0 end-0 p-3 ${variant}`}>
      <div
        id="liveToast"
        className={`toast fade ${visible ? "show" : "hide"}`}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="toast-header">
          <strong className="me-auto" dangerouslySetInnerHTML={{ __html: title }} />
          <button
            type="button"
            aria-label="Close"
            onClick={hide}
            className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:text-ink-0 hover:bg-surface-3 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="toast-body flex align-items-top">
          <FontAwesomeIcon
            className={`fa-lg me-2 mt-1 mb-1 pt-1 text-${variant}`}
            icon={getIcon()}
          />
          <div className="mt-1" dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>
    </div>
  );
}

export default Toast;
