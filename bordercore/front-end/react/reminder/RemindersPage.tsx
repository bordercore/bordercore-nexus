import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { Reminder } from "./types";
import { Spinner } from "../common/Spinner";
import { RemindersDashboard } from "./dashboard/RemindersDashboard";
import { NewReminderModal } from "./modals/NewReminderModal";
import { EditReminderModal } from "./modals/EditReminderModal";
import { DeleteReminderModal } from "./modals/DeleteReminderModal";

interface RemindersResponse {
  reminders: Reminder[];
}

interface RemindersPageProps {
  listAjaxUrl: string;
  createUrl: string;
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function RemindersPage({ listAjaxUrl, createUrl }: RemindersPageProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadReminders = useCallback(async () => {
    try {
      const response = await axios.get<RemindersResponse>(listAjaxUrl, {
        withCredentials: true,
      });
      setReminders(response.data.reminders);
    } catch (error) {
      console.error("Error loading reminders:", error);
    } finally {
      setLoading(false);
    }
  }, [listAjaxUrl]);

  useEffect(() => {
    loadReminders();
    refreshTimerRef.current = window.setInterval(loadReminders, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
    };
  }, [loadReminders]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (refreshTimerRef.current) {
          window.clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      } else {
        if (!refreshTimerRef.current) {
          loadReminders();
          refreshTimerRef.current = window.setInterval(loadReminders, REFRESH_INTERVAL_MS);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadReminders]);

  const handleCreated = useCallback(() => {
    void loadReminders();
  }, [loadReminders]);

  if (loading) {
    return (
      <div className="rm-dashboard-loading text-center p-3">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <RemindersDashboard
        reminders={reminders}
        onNew={() => setCreating(true)}
        onEdit={reminder => setEditing(reminder)}
        onDelete={reminder => setDeleting(reminder)}
      />
      <NewReminderModal
        open={creating}
        onClose={() => setCreating(false)}
        createUrl={createUrl}
        onCreated={handleCreated}
      />
      <EditReminderModal
        open={editing !== null}
        reminder={editing}
        onClose={() => setEditing(null)}
        onSaved={handleCreated}
      />
      <DeleteReminderModal
        open={deleting !== null}
        reminder={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={handleCreated}
      />
    </>
  );
}

export default RemindersPage;
