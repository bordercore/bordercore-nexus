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
  // New schedule fields
  schedule_type: string;
  trigger_time: string;
  days_of_week: number[];
  days_of_month: number[];
  // Legacy fields (kept for backward compatibility)
  interval_value: number;
  interval_unit: string;
}

interface ReminderFormErrors {
  name?: string[];
  note?: string[];
  is_active?: string[];
  create_todo?: string[];
  start_at?: string[];
  schedule_type?: string[];
  trigger_time?: string[];
  days_of_week?: string[];
  days_of_week_input?: string[];
  days_of_month?: string[];
  days_of_month_input?: string[];
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

const SCHEDULE_TYPE_CHOICES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday", short: "Mon" },
  { value: 1, label: "Tuesday", short: "Tue" },
  { value: 2, label: "Wednesday", short: "Wed" },
  { value: 3, label: "Thursday", short: "Thu" },
  { value: 4, label: "Friday", short: "Fri" },
  { value: 5, label: "Saturday", short: "Sat" },
  { value: 6, label: "Sunday", short: "Sun" },
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
    schedule_type: "daily",
    trigger_time: "09:00",
    days_of_week: [],
    days_of_month: [],
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
          // Ensure arrays are initialized
          response.data.days_of_week = response.data.days_of_week || [];
          response.data.days_of_month = response.data.days_of_month || [];
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

  const handleDayOfWeekToggle = (day: number) => {
    setFormData((prev) => {
      const currentDays = prev.days_of_week || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, days_of_week: newDays };
    });

    // Clear error when user makes a selection
    if (errors.days_of_week_input) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.days_of_week_input;
        return newErrors;
      });
    }
  };

  const handleDayOfMonthToggle = (day: number) => {
    setFormData((prev) => {
      const currentDays = prev.days_of_month || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, days_of_month: newDays };
    });

    // Clear error when user makes a selection
    if (errors.days_of_month_input) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.days_of_month_input;
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
      formDataToSend.append("csrfmiddlewaretoken", csrfToken);
      formDataToSend.append("name", formData.name);
      formDataToSend.append("note", formData.note || "");
      formDataToSend.append("is_active", formData.is_active ? "true" : "false");
      formDataToSend.append("create_todo", formData.create_todo ? "true" : "false");
      if (formData.start_at) {
        // Convert local datetime to ISO format for backend
        const date = new Date(formData.start_at);
        formDataToSend.append("start_at", date.toISOString());
      }

      // New schedule fields
      formDataToSend.append("schedule_type", formData.schedule_type);
      if (formData.trigger_time) {
        formDataToSend.append("trigger_time", formData.trigger_time);
      }
      formDataToSend.append("days_of_week_input", JSON.stringify(formData.days_of_week || []));
      formDataToSend.append("days_of_month_input", JSON.stringify(formData.days_of_month || []));

      // Legacy fields (for backward compatibility)
      formDataToSend.append("interval_value", formData.interval_value.toString());
      formDataToSend.append("interval_unit", formData.interval_unit);

      const response = await axios.post(submitUrl, formDataToSend, {
        headers: {
          "X-CSRFToken": csrfToken,
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

  // Generate days of month (1-31)
  const daysOfMonth = Array.from({ length: 31 }, (_, i) => i + 1);

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

            {/* Schedule Type */}
            <div className="mb-3">
              <label htmlFor="schedule_type" className="form-label">
                Schedule Type
              </label>
              <select
                className={`form-control form-select ${errors.schedule_type ? "is-invalid" : ""}`}
                id="schedule_type"
                name="schedule_type"
                value={formData.schedule_type}
                onChange={handleChange}
              >
                {SCHEDULE_TYPE_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {errors.schedule_type && (
                <div className="invalid-feedback d-block">
                  {errors.schedule_type.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Trigger Time - shown for all schedule types */}
            <div className="mb-3">
              <label htmlFor="trigger_time" className="form-label">
                Time
              </label>
              <input
                type="time"
                className={`form-control ${errors.trigger_time ? "is-invalid" : ""}`}
                id="trigger_time"
                name="trigger_time"
                value={formData.trigger_time}
                onChange={handleChange}
              />
              {errors.trigger_time && (
                <div className="invalid-feedback d-block">
                  {errors.trigger_time.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              )}
              <small className="form-text text-muted">What time of day to trigger the reminder.</small>
            </div>

            {/* Days of Week - shown only for weekly schedule */}
            {formData.schedule_type === "weekly" && (
              <div className="mb-3">
                <label className="form-label">Days of Week</label>
                <div className="d-flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      className={`btn ${
                        formData.days_of_week?.includes(day.value)
                          ? "btn-primary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => handleDayOfWeekToggle(day.value)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                {(errors.days_of_week_input || errors.days_of_week) && (
                  <div className="invalid-feedback d-block">
                    {(errors.days_of_week_input || errors.days_of_week)?.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </div>
                )}
                <small className="form-text text-muted">
                  Select which days of the week to trigger the reminder.
                </small>
              </div>
            )}

            {/* Days of Month - shown only for monthly schedule */}
            {formData.schedule_type === "monthly" && (
              <div className="mb-3">
                <label className="form-label">Days of Month</label>
                <div className="d-flex flex-wrap gap-1 reminder-days-container">
                  {daysOfMonth.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`btn ${
                        formData.days_of_month?.includes(day)
                          ? "btn-primary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => handleDayOfMonthToggle(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {(errors.days_of_month_input || errors.days_of_month) && (
                  <div className="invalid-feedback d-block">
                    {(errors.days_of_month_input || errors.days_of_month)?.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </div>
                )}
                <small className="form-text text-muted">
                  Select which days of the month to trigger the reminder. If a month has fewer days,
                  the reminder will trigger on the last day of the month.
                </small>
              </div>
            )}

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
                <strong>Schedule Type:</strong> Choose how often the reminder repeats:
              </p>
              <ul>
                <li><strong>Daily:</strong> Triggers every day at the specified time.</li>
                <li><strong>Weekly:</strong> Triggers on selected days of the week (e.g., every Monday and Wednesday).</li>
                <li><strong>Monthly:</strong> Triggers on selected days of the month (e.g., the 1st and 15th).</li>
              </ul>
              <p>
                <strong>Time:</strong> What time of day the reminder should trigger.
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
