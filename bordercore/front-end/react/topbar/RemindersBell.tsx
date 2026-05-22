import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { Popover } from "../common/Popover";
import { useLiveChannel } from "../common/hooks/useLiveChannel";

const ONE_HOUR_MS = 60 * 60 * 1000;

type FiredReminder = {
  uuid: string;
  name: string;
  note: string;
  firedAt: number;
};

type IncomingReminder = {
  uuid?: unknown;
  name?: unknown;
  note?: unknown;
};

type IncomingMessage = {
  type?: unknown;
  reminder?: IncomingReminder;
};

function isFireMessage(
  msg: unknown
): msg is { type: "reminder.fired"; reminder: { uuid: string; name: string; note?: string } } {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as IncomingMessage;
  if (m.type !== "reminder.fired") return false;
  const r = m.reminder;
  if (!r || typeof r !== "object") return false;
  if (typeof r.uuid !== "string" || typeof r.name !== "string") return false;
  return true;
}

function formatAgo(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  return `${minutes}m ago`;
}

export default function RemindersBell() {
  const [fired, setFired] = useState<FiredReminder[]>([]);
  const [open, setOpen] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [open]);

  // useLiveChannel internally stores onMessage in a ref, so passing a
  // fresh inline arrow each render is correct — no re-connection happens.
  useLiveChannel("/ws/reminders/", msg => {
    if (!isFireMessage(msg)) return;
    const r = msg.reminder;
    const entry: FiredReminder = {
      uuid: r.uuid,
      name: r.name,
      note: typeof r.note === "string" ? r.note : "",
      firedAt: Date.now(),
    };
    setFired(prev => [entry, ...prev.filter(x => x.uuid !== r.uuid)]);

    const existing = timersRef.current.get(r.uuid);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFired(prev => prev.filter(x => x.uuid !== r.uuid));
      timersRef.current.delete(r.uuid);
    }, ONE_HOUR_MS);
    timersRef.current.set(r.uuid, t);
  });

  useEffect(
    () => () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    },
    []
  );

  const clearAll = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
    setFired([]);
    setOpen(false);
  };

  if (fired.length === 0) return null;

  const trigger = (
    <button
      type="button"
      className="refined-tb-reminders"
      aria-label={`${fired.length} reminder${fired.length === 1 ? "" : "s"} fired recently`}
    >
      <FontAwesomeIcon icon={faBell} />
      <span className="num">{fired.length}</span>
      <span className="word">reminder{fired.length === 1 ? "" : "s"}</span>
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offsetDistance={6}
    >
      <div className="refined-tb-reminders-menu" role="menu">
        {fired.map(r => (
          <a
            key={r.uuid}
            href={`/reminder/${r.uuid}/`}
            className="refined-tb-reminders-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <div className="row">
              <span className="name">{r.name}</span>
              <span className="ago">{formatAgo(now - r.firedAt)}</span>
            </div>
            {r.note && <div className="note">{r.note}</div>}
          </a>
        ))}
        <div className="refined-tb-reminders-divider" />
        <button type="button" className="refined-tb-reminders-clear" onClick={clearAll}>
          Clear all
        </button>
      </div>
    </Popover>
  );
}
