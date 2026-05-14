import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faExclamationTriangle,
  faQuestion,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

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

type Variant = "info" | "danger" | "warning" | "success";

// Map toast variant to the theme-aware Tailwind utility for the leading
// icon's colour. Three of the four variants don't have a class that matches
// their name (warning / success / danger → warn / ok / danger), so a direct
// `text-${variant}` interpolation would emit dead classes.
const VARIANT_ICON_CLASS: Record<Variant, string> = {
  info: "text-accent",
  danger: "text-danger",
  warning: "text-warn",
  success: "text-ok",
};

export function Toast({ initialMessages = [], defaultVariant = "info" }: ToastProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [variant, setVariant] = useState<Variant>(defaultVariant);
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

  // The fixed-position wrapper stays mounted so the EventBus listener
  // keeps running; the toast card itself is conditionally rendered so
  // nothing shows on screen unless EventBus emits a "toast" event.
  return (
    <div className="toast-wrapper fixed top-0 end-0 p-4 z-50 pointer-events-none">
      {visible && (
        <div
          id="liveToast"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="pointer-events-auto w-[350px] max-w-full rounded border border-line-soft bg-surface-1 shadow-lg"
        >
          <div className="flex items-center px-3 py-2 border-b border-line-soft bg-surface-2 rounded-t">
            <strong className="me-auto text-sm" dangerouslySetInnerHTML={{ __html: title }} />
            <button
              type="button"
              aria-label="Close"
              onClick={hide}
              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:text-ink-0 hover:bg-surface-3 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="p-3 flex items-start">
            <FontAwesomeIcon
              className={`fa-lg me-2 mt-1 mb-1 pt-1 ${VARIANT_ICON_CLASS[variant]}`}
              icon={getIcon()}
            />
            <div className="mt-1 text-sm" dangerouslySetInnerHTML={{ __html: body }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Toast;
