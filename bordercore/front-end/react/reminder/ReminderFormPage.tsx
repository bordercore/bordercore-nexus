import React from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

interface ReminderFormData {
  name: string;
  note: string;
  is_active: boolean;
  create_todo: boolean;
  start_at: string;
  interval_value: number;
  interval_unit: string;
}

interface ReminderFormErrors {
  name?: string[];
  note?: string[];
  is_active?: string[];
  create_todo?: string[];
  start_at?: string[];
  interval_value?: string[];
  interval_unit?: string[];
  non_field_errors?: string[];
}

interface ReminderFormPageProps {
  formAjaxUrl: string;
  submitUrl: string;
  cancelUrl: string;
  isEdit: boolean;
  csrfToken: string;
}

const INTERVAL_UNIT_CHOICES = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function ReminderFormPage({
  formAjaxUrl,
  submitUrl,
  cancelUrl,
  isEdit,
  csrfToken,
}: ReminderFormPageProps) {
  const [formData, setFormData] = React.useState<ReminderFormData>({
    name: "",
    note: "",
    is_active: true,
    create_todo: false,
    start_at: "",
    interval_value: 1,
    interval_unit: "day",
  });
  const [errors, setErrors] = React.useState<ReminderFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const fetchFormData = async () => {
      if (isEdit && formAjaxUrl) {
        try {
          setLoading(true);
          const response = await axios.get<ReminderFormData>(formAjaxUrl);
          // Convert datetime to local format for datetime-local input
          if (response.data.start_at) {
            const date = new Date(response.data.start_at);
            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            response.data.start_at = localDateTime;
          }
          setFormData(response.data);
        } catch (err) {
          console.error("Error fetching form data:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [isEdit, formAjaxUrl]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value, 10) || 0 : value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof ReminderFormErrors]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof ReminderFormErrors];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const formDataToSend = new URLSearchParams();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("note", formData.note || "");
      formDataToSend.append("is_active", formData.is_active ? "true" : "false");
      formDataToSend.append("create_todo", formData.create_todo ? "true" : "false");
      if (formData.start_at) {
        // Convert local datetime to ISO format for backend
        const date = new Date(formData.start_at);
        formDataToSend.append("start_at", date.toISOString());
      }
      formDataToSend.append("interval_value", formData.interval_value.toString());
      formDataToSend.append("interval_unit", formData.interval_unit);

      const response = await axios.post(submitUrl, formDataToSend, {
        headers: {
          "X-Csrftoken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      // Redirect on success
      if (response.data.success && response.data.redirect_url) {
        window.location.href = response.data.redirect_url;
      } else {
        window.location.href = cancelUrl;
      }
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (err.response?.data) {
        // Handle Django form errors format
        const formErrors: ReminderFormErrors = {};
        Object.keys(err.response.data).forEach((key) => {
          if (Array.isArray(err.response.data[key])) {
            formErrors[key as keyof ReminderFormErrors] = err.response.data[key];
          }
        });
        setErrors(formErrors);
      } else {
        setErrors({ non_field_errors: [err.message || "An error occurred"] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row mb-4">
        <div className="col-md-8">
          <h1>{isEdit ? "Edit Reminder" : "Create Reminder"}</h1>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <form className="reminder-form" onSubmit={handleSubmit} noValidate>
            {errors.non_field_errors && (
              <div className="alert alert-danger" role="alert">
                {errors.non_field_errors.map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Reminder Name
              </label>
              <input
                type="text"
                className={`form-control ${errors.name ? "is-invalid" : ""}`}
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Water plants"
                required
              />
              {errors.name && (
                <div className="invalid-feedback d-block">
                  {errors.name.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="note" className="form-label">
                Notes
              </label>
              <textarea
                className={`form-control ${errors.note ? "is-invalid" : ""}`}
                id="note"
                name="note"
                rows={3}
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional notes about this reminder"
              />
              {errors.note && (
                <div className="invalid-feedback d-block">
                  {errors.note.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="interval_value" className="form-label">
                Repeat Every
              </label>
              <div className="input-group">
                <input
                  type="number"
                  className={`form-control ${errors.interval_value ? "is-invalid" : ""}`}
                  id="interval_value"
                  name="interval_value"
                  min="1"
                  value={formData.interval_value}
                  onChange={handleChange}
                  required
                />
                <select
                  className={`form-control form-select ${errors.interval_unit ? "is-invalid" : ""}`}
                  id="interval_unit"
                  name="interval_unit"
                  value={formData.interval_unit}
                  onChange={handleChange}
                >
                  {INTERVAL_UNIT_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.interval_value && (
                <div className="invalid-feedback d-block">
                  {errors.interval_value.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
              {errors.interval_unit && (
                <div className="invalid-feedback d-block">
                  {errors.interval_unit.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="start_at" className="form-label">
                Start Date (optional)
              </label>
              <input
                type="datetime-local"
                className={`form-control ${errors.start_at ? "is-invalid" : ""}`}
                id="start_at"
                name="start_at"
                value={formData.start_at}
                onChange={handleChange}
              />
              {errors.start_at && (
                <div className="invalid-feedback d-block">
                  {errors.start_at.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
              <small className="form-text text-muted">When to start the reminder schedule.</small>
            </div>

            <div className="mb-3">
              <div className="form-check">
                <input
                  className={`form-check-input ${errors.is_active ? "is-invalid" : ""}`}
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="is_active">
                  Active
                </label>
              </div>
              {errors.is_active && (
                <div className="invalid-feedback d-block">
                  {errors.is_active.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3">
              <div className="form-check">
                <input
                  className={`form-check-input ${errors.create_todo ? "is-invalid" : ""}`}
                  type="checkbox"
                  id="create_todo"
                  name="create_todo"
                  checked={formData.create_todo}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="create_todo">
                  Create Todo Task
                </label>
              </div>
              {errors.create_todo && (
                <div className="invalid-feedback d-block">
                  {errors.create_todo.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
              <small className="form-text text-muted">
                When enabled, a todo task will be automatically created when this reminder triggers.
              </small>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving..." : isEdit ? "Update Reminder" : "Create Reminder"}
              </button>
              <a href={cancelUrl} className="btn btn-outline-secondary">
                <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
                Cancel
              </a>
            </div>
          </form>
        </div>

        <div className="col-md-6">
          <div className="card dashboard-card h-100">
            <div className="card-body">
              <h5 className="card-title mb-4">Help</h5>
              <p>
                <strong>Reminder Name:</strong> A short, descriptive name for what you want to
                remember.
              </p>
              <p>
                <strong>Notes:</strong> Optional details or context about the reminder.
              </p>
              <p>
                <strong>Frequency:</strong> How often this reminder should repeat (every 1 day,
                every 2 weeks, etc.).
              </p>
              <p>
                <strong>Start Date:</strong> When to begin the reminder schedule. If not set,
                reminders can begin immediately.
              </p>
              <p>
                <strong>Active:</strong> Enable or disable this reminder without deleting it.
              </p>
              <p>
                <strong>Create Todo Task:</strong> When enabled, a todo task will be automatically
                created in your todo list each time this reminder triggers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReminderFormPage;

