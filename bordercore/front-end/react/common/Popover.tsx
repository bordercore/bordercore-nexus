import React, { useState, useRef, cloneElement, isValidElement, ReactNode, ReactElement } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  Placement,
  Alignment,
  useHover,
  safePolygon,
  useTransitionStyles,
} from "@floating-ui/react";

export interface PopoverProps {
  /** The trigger element that opens the popover */
  trigger: ReactElement;
  /** The content to display in the popover */
  children: ReactNode;
  /** Placement of the popover relative to trigger */
  placement?: Placement;
  /** Alignment of the popover relative to trigger */
  alignment?: Alignment;
  /** Whether to open on hover instead of click */
  openOnHover?: boolean;
  /** Offset distance from the trigger */
  offsetDistance?: number;
  /** Custom class name for the popover container */
  className?: string;
  /** Whether the popover is initially open */
  initialOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to show an arrow */
  showArrow?: boolean;
  /** Custom styles for the popover */
  style?: React.CSSProperties;
}

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  alignment,
  openOnHover = false,
  offsetDistance = 8,
  className = "",
  initialOpen = false,
  open: controlledOpen,
  onOpenChange,
  showArrow = false,
  style,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const arrowRef = useRef<HTMLDivElement>(null);

  // Custom offset function to align right edges when using bottom-end placement
  const getOffset = () => {
    // For bottom-end placement, we want the popover's right edge to align with the trigger's right edge
    // The default offset only handles the main axis (vertical), so we need to handle cross-axis (horizontal) alignment
    if (placement === "bottom-end" || placement?.endsWith("-end")) {
      return offset({
        mainAxis: offsetDistance,
        crossAxis: 0, // This will align the end (right) edges
      });
    }
    return offset(offsetDistance);
  };

  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    alignment,
    strategy: "absolute",
    middleware: [
      getOffset(),
      flip({
        fallbackAxisSideDirection: "end",
        padding: 8,
      }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: (reference, floating, update) => 
      autoUpdate(reference, floating, update, { elementResize: false, layoutShift: false }),
  });

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: 150,
    initial: {
      opacity: 0,
      transform: "scale(0.95)",
    },
    open: {
      opacity: 1,
      transform: "scale(1)",
    },
    close: {
      opacity: 0,
      transform: "scale(0.95)",
    },
  });

  const click = useClick(context, { enabled: !openOnHover });
  const hover = useHover(context, {
    enabled: openOnHover,
    handleClose: safePolygon(),
    delay: { open: 75, close: 150 },
  });
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    hover,
    dismiss,
    role,
  ]);

  // Clone trigger element and attach ref and props
  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        ref: refs.setReference,
        ...getReferenceProps(),
      } as any)
    : trigger;

  return (
    <div className="popover-container">
      {triggerElement}
      {isMounted && (
        <div
          ref={refs.setFloating}
          // Dynamic styles from floating-ui library - must remain inline
          style={{
            ...floatingStyles,
            transform: `${floatingStyles.transform || ""} ${transitionStyles.transform || ""}`.trim() || undefined,
            opacity: transitionStyles.opacity,
            ...style,
          }}
          className={`popover-floating ${className}`}
          {...getFloatingProps()}
        >
          {showArrow && (
            <div
              ref={arrowRef}
              className="popover-arrow"
              // Dynamic arrow positioning from floating-ui - must remain inline
              style={{
                left: middlewareData.arrow?.x,
                top: middlewareData.arrow?.y,
              }}
            />
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export default Popover;
