import React from "react";
import { createRoot } from "react-dom/client";
import PreferencesPage from "../react/prefs/PreferencesPage";

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

const container = document.getElementById("react-root");
if (container) {
  // Get data from data attributes
  const formAction = container.getAttribute("data-form-action") || "";
  const csrfToken = container.getAttribute("data-csrf-token") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const passwordUrl = container.getAttribute("data-password-url") || "";
  const authToken = container.getAttribute("data-auth-token") || "";
  const groups = container.getAttribute("data-groups") || "";
  const sidebarImage = container.getAttribute("data-sidebar-image") || "";
  const backgroundImage = container.getAttribute("data-background-image") || "";
  const eyeCandy = container.getAttribute("data-eye-candy") === "true";
  const instagramUsername =
    container.getAttribute("data-instagram-username") || "";
  const instagramPassword =
    container.getAttribute("data-instagram-password") || "";

  // Parse initial tags from json_script
  let initialTags: string[] = [];
  const tagsScript = document.getElementById("initial-tags");
  if (tagsScript) {
    try {
      initialTags = JSON.parse(tagsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing initial tags:", e);
    }
  }

  // Parse form fields from json_script
  let formFields: FormField[] = [];
  const fieldsScript = document.getElementById("formFields");
  if (fieldsScript) {
    try {
      formFields = JSON.parse(fieldsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing form fields:", e);
    }
  }

  const root = createRoot(container);
  root.render(
    <PreferencesPage
      formAction={formAction}
      csrfToken={csrfToken}
      tagSearchUrl={tagSearchUrl}
      passwordUrl={passwordUrl}
      authToken={authToken}
      groups={groups}
      sidebarImage={sidebarImage}
      backgroundImage={backgroundImage}
      eyeCandy={eyeCandy}
      initialTags={initialTags}
      instagramUsername={instagramUsername}
      instagramPassword={instagramPassword}
      formFields={formFields}
    />
  );
}
