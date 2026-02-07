import React from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

interface ReminderDeletePageProps {
  reminderName: string;
  deleteUrl: string;
  cancelUrl: string;
  csrfToken: string;
}

export function ReminderDeletePage({
  reminderName,
  deleteUrl,
  cancelUrl,
  csrfToken,
}: ReminderDeletePageProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      // Django DeleteView expects POST with empty body (or just CSRF token)
      formData.append("csrfmiddlewaretoken", csrfToken);

      await axios.post(deleteUrl, formData, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      // On success, redirect to the app (success_url)
      // Django DeleteView will redirect after deletion, axios will follow it,
      // but we need to manually navigate the browser
      window.location.href = "/reminder/";
    } catch (err: any) {
      console.error("Error deleting reminder:", err);
      setError("Failed to delete reminder. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-6 offset-md-3">
          <div className="card border-danger">
            <div className="card-body">
              <h5 className="card-title text-danger">Delete Reminder?</h5>
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              <p className="card-text">
                Are you sure you want to delete "<strong>{reminderName}</strong>"?
              </p>
              <p className="text-muted">This action cannot be undone.</p>

              <form method="post" onSubmit={handleSubmit}>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-danger" disabled={submitting}>
                    {submitting ? "Deleting..." : "Delete"}
                  </button>
                  <a href={cancelUrl} className="btn btn-outline-secondary">
                    <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
                    Cancel
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReminderDeletePage;
