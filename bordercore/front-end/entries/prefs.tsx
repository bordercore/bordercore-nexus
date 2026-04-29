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
  const formAction = container.getAttribute("data-form-action") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const passwordUrl = container.getAttribute("data-password-url") || "";
  const prefsUrl = container.getAttribute("data-prefs-url") || formAction;
  const authToken = container.getAttribute("data-auth-token") || "";
  const username = container.getAttribute("data-username") || "";
  const groups = container.getAttribute("data-groups") || "";
  const sidebarImageUrl = container.getAttribute("data-sidebar-image-url") || "";
  const sidebarImageName = container.getAttribute("data-sidebar-image-name") || "";
  const backgroundImageUrl = container.getAttribute("data-background-image-url") || "";
  const backgroundImageName = container.getAttribute("data-background-image-name") || "";
  const eyeCandy = container.getAttribute("data-eye-candy") === "true";
  const instagramUsername = container.getAttribute("data-instagram-username") || "";
  const instagramPassword = container.getAttribute("data-instagram-password") || "";

  let initialTags: string[] = [];
  const tagsScript = document.getElementById("initial-tags");
  if (tagsScript) {
    try {
      initialTags = JSON.parse(tagsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing initial tags:", e);
    }
  }

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
      tagSearchUrl={tagSearchUrl}
      passwordUrl={passwordUrl}
      prefsUrl={prefsUrl}
      authToken={authToken}
      username={username}
      groups={groups}
      sidebarImageUrl={sidebarImageUrl}
      sidebarImageName={sidebarImageName}
      backgroundImageUrl={backgroundImageUrl}
      backgroundImageName={backgroundImageName}
      eyeCandy={eyeCandy}
      initialTags={initialTags}
      instagramUsername={instagramUsername}
      instagramPassword={instagramPassword}
      formFields={formFields}
    />
  );
}
