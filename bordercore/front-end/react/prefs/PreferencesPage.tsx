import React, { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfo } from "@fortawesome/free-solid-svg-icons";
import TagsInput from "../common/TagsInput";
import ToggleSwitch from "../common/ToggleSwitch";
import FileUploadField from "./FileUploadField";

interface FormField {
  name: string;
  label: string;
  value: string;
  type: string;
  widget: string;
  required: boolean;
  choices: [string, string][];
  errors: string[];
}

interface PreferencesPageProps {
  formAction: string;
  csrfToken: string;
  tagSearchUrl: string;
  passwordUrl: string;
  authToken: string;
  groups: string;
  sidebarImage: string;
  backgroundImage: string;
  eyeCandy: boolean;
  initialTags: string[];
  instagramUsername: string;
  instagramPassword: string;
  formFields: FormField[];
}

export function PreferencesPage({
  formAction,
  csrfToken,
  tagSearchUrl,
  passwordUrl,
  authToken,
  groups,
  sidebarImage,
  backgroundImage,
  eyeCandy: initialEyeCandy,
  initialTags,
  instagramUsername,
  instagramPassword,
  formFields,
}: PreferencesPageProps) {
  const [eyeCandy, setEyeCandy] = useState(initialEyeCandy);

  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      document.documentElement.setAttribute("color-mode", e.target.value);
    },
    []
  );

  // Render a standard form field based on its type
  const renderFormField = (field: FormField) => {
    // Skip fields that we handle specially
    if (
      [
        "background_image",
        "sidebar_image",
        "drill_tags_muted",
        "eye_candy",
        "instagram_credentials",
      ].includes(field.name)
    ) {
      return null;
    }

    return (
      <div
        key={field.name}
        className={`${field.errors.length > 0 ? "error" : ""} row mb-3`}
      >
        <label className="fw-bold col-lg-3 col-sm-2 col-form-label text-end">
          {field.label}
        </label>
        <div className="col-lg-7">
          {field.name === "theme" ? (
            <select
              name="theme"
              className="form-control form-select"
              id="id_theme"
              defaultValue={field.value}
              onChange={handleThemeChange}
            >
              {field.choices.map((choice) => (
                <option key={choice[0]} value={choice[0]}>
                  {choice[1]}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" || field.widget === "textarea" ? (
            <textarea
              name={field.name}
              className="form-control"
              id={`id_${field.name}`}
              defaultValue={field.value}
              required={field.required}
            />
          ) : field.choices && field.choices.length > 0 ? (
            <select
              name={field.name}
              className="form-control form-select"
              id={`id_${field.name}`}
              defaultValue={field.value}
            >
              {field.choices.map((choice) => (
                <option key={choice[0]} value={choice[0]}>
                  {choice[1]}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.widget || "text"}
              name={field.name}
              className="form-control"
              id={`id_${field.name}`}
              defaultValue={field.value}
              required={field.required}
              autoComplete="off"
            />
          )}
          {field.errors.map((error, idx) => (
            <span key={idx} className="form-error">
              {error}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Find specific field values from formFields
  const getFieldValue = (name: string): string => {
    const field = formFields.find((f) => f.name === name);
    return field?.value || "";
  };

  const getFieldChoices = (name: string): [string, string][] => {
    const field = formFields.find((f) => f.name === name);
    return field?.choices || [];
  };

  const themeChoices = getFieldChoices("theme");
  const themeValue = getFieldValue("theme");

  return (
    <div className="row g-0 h-100 mx-2">
      {/* Left sidebar with info */}
      <div className="col-lg-3 d-flex flex-column">
        <div className="card-body">
          <div className="d-flex flex-column mt-3">
            <div className="d-flex align-items-center me-2 pt-1">
              <div className="circle me-3 mb-2">
                <FontAwesomeIcon icon={faInfo} />
              </div>
              <h6 className="text-secondary">Preferences change</h6>
            </div>
            <div>Change various aspects of your Bordercore experience.</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="col-lg-9">
        <div className="card-grid ms-3 me-3">
          {/* Tab navigation */}
          <ul
            className="nav nav-tabs justify-content-center mb-2"
            id="v-pills-tab"
            role="tablist"
            aria-orientation="horizontal"
          >
            <li className="nav-item">
              <a
                className="nav-link active"
                href="#"
                role="tab"
                aria-controls="v-pills-main"
                aria-selected="true"
              >
                Main
              </a>
            </li>
            <li className="nav-item">
              <a
                className="nav-link"
                href={passwordUrl}
                role="tab"
                aria-controls="v-pills-password"
                aria-selected="false"
              >
                Password
              </a>
            </li>
          </ul>

          {/* Preferences form */}
          <form
            encType="multipart/form-data"
            id="prefs-form"
            action={formAction}
            method="post"
          >
            <input
              type="hidden"
              name="csrfmiddlewaretoken"
              value={csrfToken}
            />

            {/* API Token */}
            <div className="row mb-3">
              <label className="fw-bold col-lg-3 col-form-label text-end">
                API Token
              </label>
              <div className="col-lg-7 align-self-center">
                {authToken || "None"}
              </div>
            </div>

            {/* Groups (conditional) */}
            {groups && (
              <div className="row mb-3">
                <label className="fw-bold col-lg-3 col-form-label text-end">
                  Groups
                </label>
                <div className="col-lg-7 align-self-center">{groups}</div>
              </div>
            )}

            {/* Background Image */}
            <FileUploadField
              name="background_image"
              label="Background Image"
              initialFilename={backgroundImage}
              deleteName="delete_background"
            />

            {/* Sidebar Image */}
            <FileUploadField
              name="sidebar_image"
              label="Sidebar Image"
              initialFilename={sidebarImage}
              deleteName="delete_sidebar"
            />

            {/* Drill Muted Tags */}
            <div className="row mb-3">
              <label className="fw-bold col-lg-3 col-form-label text-end">
                Drill Muted Tags
              </label>
              <div className="col-lg-7 d-flex">
                <TagsInput
                  name="drill_tags_muted"
                  searchUrl={tagSearchUrl}
                  initialTags={initialTags}
                />
              </div>
            </div>

            {/* Eye Candy */}
            <div className="row mb-3">
              <label
                className="fw-bold col-lg-3 col-form-label text-end"
                htmlFor="eye_candy"
              >
                Eye Candy
              </label>
              <div className="col-lg-7 d-flex">
                <ToggleSwitch
                  name="eye_candy"
                  checked={eyeCandy}
                  onChange={setEyeCandy}
                />
              </div>
            </div>

            {/* Theme */}
            {themeChoices.length > 0 && (
              <div className="row mb-3">
                <label className="fw-bold col-lg-3 col-sm-2 col-form-label text-end">
                  Theme
                </label>
                <div className="col-lg-7">
                  <select
                    name="theme"
                    className="form-control form-select"
                    id="id_theme"
                    defaultValue={themeValue}
                    onChange={handleThemeChange}
                  >
                    {themeChoices.map((choice) => (
                      <option key={choice[0]} value={choice[0]}>
                        {choice[1]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Instagram Credentials */}
            <div className="row mb-3">
              <label className="fw-bold col-lg-3 col-sm-2 col-form-label text-end">
                Instagram Credentials
              </label>
              <div className="col-lg-7">
                <div className="d-flex">
                  <input
                    type="text"
                    name="instagram_username"
                    defaultValue={instagramUsername}
                    className="form-control me-2"
                    placeholder="Username"
                    autoComplete="off"
                  />
                  <input
                    type="password"
                    name="instagram_password"
                    defaultValue={instagramPassword}
                    className="form-control ms-2"
                    placeholder="Password"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {/* Other form fields */}
            {formFields
              .filter(
                (f) =>
                  ![
                    "background_image",
                    "sidebar_image",
                    "drill_tags_muted",
                    "eye_candy",
                    "instagram_credentials",
                    "theme",
                  ].includes(f.name)
              )
              .map(renderFormField)}

            {/* Submit button */}
            <div className="row mb-3">
              <div className="col-lg-1 offset-lg-3">
                <input
                  className="btn btn-primary me-1"
                  type="submit"
                  name="Go"
                  value="Update"
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PreferencesPage;
