import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle, faQuestion } from "@fortawesome/free-solid-svg-icons";
import { Toast as BootstrapToast } from "bootstrap";

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
  const [delay, setDelay] = useState(5000);
  const [autoHide, setAutoHide] = useState(true);
  const toastRef = useRef<HTMLDivElement>(null);
  const bsToastRef = useRef<BootstrapToast | null>(null);

  const getIcon = () => {
    if (variant === "danger") {
      return faExclamationTriangle;
    } else if (variant === "warning") {
      return faQuestion;
    } else {
      return faCheck;
    }
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
    if (payload.autoHide !== undefined && bsToastRef.current) {
      bsToastRef.current._config.autohide = payload.autoHide;
    }
    if (payload.delay && bsToastRef.current) {
      bsToastRef.current._config.delay = payload.delay;
    }
    if (bsToastRef.current) {
      bsToastRef.current.show();
    }
  };

  useEffect(() => {
    if (toastRef.current) {
      const toastElement = toastRef.current.querySelector(".toast");
      if (toastElement) {
        bsToastRef.current = new BootstrapToast(toastElement, {
          autohide: autoHide,
          delay: delay,
        });

        // Listen for toast events from EventBus
        if (window.EventBus) {
          const handler = (payload: ToastMessage) => {
            showToast(payload);
          };
          window.EventBus.$on("toast", handler);

          // Show initial messages
          initialMessages.forEach((message) => {
            showToast(message);
          });

          return () => {
            window.EventBus.$off("toast", handler);
          };
        }
      }
    }
  }, []);

  return (
    <div className={`toast-wrapper position-fixed top-0 end-0 p-3 ${variant}`}>
      <div id="liveToast" className="toast hide" role="alert" aria-live="assertive" aria-atomic="true" ref={toastRef}>
        <div className="toast-header">
          <strong className="me-auto" dangerouslySetInnerHTML={{ __html: title }} />
          <button type="button" className="btn-close" data-bs-dismiss="toast" aria-label="Close" />
        </div>
        <div className="toast-body d-flex align-items-top">
          <FontAwesomeIcon className={`fa-lg me-2 mt-1 mb-1 pt-1 text-${variant}`} icon={getIcon()} />
          <div className="mt-1" dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>
    </div>
  );
}

export default Toast;

