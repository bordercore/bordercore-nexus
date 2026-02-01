import React from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";

// Initialize markdown-it renderer
const markdown = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface ReminderDetail {
  uuid: string;
  name: string;
  note: string;
  is_active: boolean;
  // New schedule fields
  schedule_type: string;
  schedule_type_display: string;
  schedule_description: string;
  trigger_time: string | null;
  days_of_week: number[];
  days_of_week_display: string[];
  days_of_month: number[];
  // Legacy fields (for backward compatibility)
  interval_value: number;
  interval_unit_display: string;
  // Timestamps
  next_trigger_at: string | null;
  last_triggered_at: string | null;
  start_at: string | null;
  created: string;
  updated: string;
  // URLs
  update_url: string;
  delete_url: string;
  app_url: string;
}

interface ReminderDetailPageProps {
  detailAjaxUrl: string;
}

export function ReminderDetailPage({ detailAjaxUrl }: ReminderDetailPageProps) {
  const [reminder, setReminder] = React.useState<ReminderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchReminder = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ReminderDetail>(detailAjaxUrl);
        setReminder(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching reminder details:", err);
        setError("Failed to load reminder details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchReminder();
  }, [detailAjaxUrl]);

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !reminder) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error || "Reminder not found."}
        </div>
        <a href="/reminder/" className="btn btn-outline-secondary">
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Back to Reminders
        </a>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row mb-4">
        <div className="col-md-8">
          <h1>{reminder.name}</h1>
          {reminder.note && (
            <div
              className="text-muted markdown"
              dangerouslySetInnerHTML={{ __html: markdown.render(reminder.note) }}
            />
          )}
        </div>
        <div className="col-md-4 text-end">
          <div className="btn-group">
            <a href={reminder.update_url} className="btn btn-secondary">
              <FontAwesomeIcon icon={faEdit} className="me-2" />
              Edit
            </a>
            <a href={reminder.delete_url} className="btn btn-danger">
              <FontAwesomeIcon icon={faTrash} className="me-2" />
              Delete
            </a>
            <a href={reminder.app_url} className="btn btn-outline-secondary">
              <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
              Back
            </a>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card dashboard-card h-100">
            <div className="card-body">
              <h5 className="card-title mb-4">Schedule</h5>
              <dl className="row mb-0">
                <dt className="col-sm-5">Status</dt>
                <dd className="col-sm-7">
                  {reminder.is_active ? (
                    <span className="badge bg-success">Active</span>
                  ) : (
                    <span className="badge bg-secondary">Inactive</span>
                  )}
                </dd>

                <dt className="col-sm-5 mt-2">Schedule Type</dt>
                <dd className="col-sm-7 mt-2">{reminder.schedule_type_display}</dd>

                <dt className="col-sm-5 mt-2">Schedule</dt>
                <dd className="col-sm-7 mt-2">{reminder.schedule_description}</dd>

                {reminder.schedule_type === "weekly" &&
                  reminder.days_of_week_display.length > 0 && (
                    <>
                      <dt className="col-sm-5 mt-2">Days</dt>
                      <dd className="col-sm-7 mt-2">{reminder.days_of_week_display.join(", ")}</dd>
                    </>
                  )}

                {reminder.schedule_type === "monthly" && reminder.days_of_month.length > 0 && (
                  <>
                    <dt className="col-sm-5 mt-2">Days of Month</dt>
                    <dd className="col-sm-7 mt-2">{reminder.days_of_month.join(", ")}</dd>
                  </>
                )}

                <dt className="col-sm-5 mt-2">Time</dt>
                <dd className="col-sm-7 mt-2">{reminder.trigger_time || "Not set"}</dd>

                <dt className="col-sm-5 mt-2">Next Trigger</dt>
                <dd className="col-sm-7 mt-2">{reminder.next_trigger_at || "Not scheduled"}</dd>

                <dt className="col-sm-5 mt-2">Last Triggered</dt>
                <dd className="col-sm-7 mt-2">{reminder.last_triggered_at || "Never"}</dd>

                <dt className="col-sm-5 mt-2">Start Date</dt>
                <dd className="col-sm-7 mt-2">{reminder.start_at || "Not set"}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card dashboard-card h-100">
            <div className="card-body">
              <h5 className="card-title mb-4">Metadata</h5>
              <dl className="row mb-0">
                <dt className="col-sm-5">Created</dt>
                <dd className="col-sm-7">{reminder.created}</dd>

                <dt className="col-sm-5 mt-2">Updated</dt>
                <dd className="col-sm-7">{reminder.updated}</dd>

                <dt className="col-sm-5 mt-2">UUID</dt>
                <dd className="col-sm-7">
                  <code className="reminder-uuid">{reminder.uuid}</code>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReminderDetailPage;
