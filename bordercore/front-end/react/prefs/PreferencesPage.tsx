import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrillIntervals from "./components/DrillIntervals";
import FileDrop, { FileDropValue } from "./components/FileDrop";
import PreferencesLayout from "./components/PreferencesLayout";
import Row from "./components/Row";
import SaveBar from "./components/SaveBar";
import SecretField from "./components/SecretField";
import Select from "./components/Select";
import SectionCard from "./components/SectionCard";
import TagInput from "./components/TagInput";
import ThemePicker, { ThemeOption } from "./components/ThemePicker";
import Toggle from "./components/Toggle";

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

export interface PreferencesPageProps {
  formAction: string;
  tagSearchUrl: string;
  passwordUrl: string;
  prefsUrl: string;
  authToken: string;
  username: string;
  groups: string;
  sidebarImageUrl: string;
  sidebarImageName: string;
  backgroundImageUrl: string;
  backgroundImageName: string;
  eyeCandy: boolean;
  initialTags: string[];
  instagramUsername: string;
  instagramPassword: string;
  formFields: FormField[];
}

interface FieldState {
  eyeCandy: boolean;
  theme: string;
  topbarAnimation: string;
  background: FileDropValue;
  sidebar: FileDropValue;
  drillMutedTags: string[];
  drillIntervals: number[];
  defaultCollection: string;
  imageCollection: string;
  bookmarksPerPage: string;
  instagramUsername: string;
  instagramPassword: string;
  nytimesApiKey: string;
  googleCalendar: string;
  googleCalendarEmail: string;
}

// Palette used to render theme preview cards. Keys match Django theme css_ids.
// These hex literals are INTENTIONAL: each entry is a thumbnail of what the
// corresponding theme actually looks like, so the picker can render every
// theme's swatch simultaneously without applying that theme to the page. They
// are sampled from the --bg-1 / --bg-2 / --accent / --fg-1 tokens in
// static/scss/themes/_theme-<id>.scss; if you change a theme's tokens,
// update its swatch here so the preview stays honest.
const THEME_PALETTE: Record<string, Omit<ThemeOption, "value" | "label">> = {
  light: { bg: "#f5f2ea", panel: "#eae6da", accent: "#6c4dff", text: "#2a2822" },
  dark: { bg: "#0b0d14", panel: "#12141c", accent: "#7c7fff", text: "#e6e8f0" },
  purple: { bg: "#0e0e12", panel: "#17171d", accent: "#9a8cff", text: "#e6e6ed" },
  cyberpunk: { bg: "#14061c", panel: "#1d0a2a", accent: "#ff3dbd", text: "#f4cce6" },
  nebula: { bg: "#0b0d14", panel: "#12141c", accent: "#b36bff", text: "#e6e8f0" },
  "cobalt-abyss": { bg: "#0a0f1c", panel: "#101827", accent: "#4cc2ff", text: "#dbe8f5" },
};

const DEFAULT_PREVIEW = {
  bg: "#1b1a21",
  panel: "#2a2833",
  accent: "#9d7fff",
  text: "#d4d1dc",
};

function getField(fields: FormField[], name: string): FormField | undefined {
  return fields.find(f => f.name === name);
}

function parseDrillIntervals(raw: string): number[] {
  if (!raw) return [];
  // Django ArrayField renders as "[1, 2, 3]" or "1,2,3" depending on widget.
  const normalized = raw.replace(/[[\]\s]/g, "");
  return normalized
    .split(",")
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

function basename(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url, window.location.origin);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  }
}

export function PreferencesPage(props: PreferencesPageProps) {
  const {
    formAction,
    tagSearchUrl,
    passwordUrl,
    prefsUrl,
    authToken,
    username,
    groups,
    sidebarImageUrl,
    sidebarImageName,
    backgroundImageUrl,
    backgroundImageName,
    eyeCandy,
    initialTags,
    instagramUsername,
    instagramPassword,
    formFields,
  } = props;

  const themeField = getField(formFields, "theme");
  const themeChoices = themeField?.choices || [];

  const themeOptions: ThemeOption[] = themeChoices.map(([value, label]) => {
    const palette = THEME_PALETTE[value] || DEFAULT_PREVIEW;
    return { value, label, ...palette };
  });

  const topbarAnimationField = getField(formFields, "topbar_animation");
  const topbarAnimationOptions = (topbarAnimationField?.choices || []).map(([value, label]) => ({
    value,
    label,
  }));

  const defaultCollectionField = getField(formFields, "homepage_default_collection");
  const imageCollectionField = getField(formFields, "homepage_image_collection");
  const bookmarksPerPageField = getField(formFields, "bookmarks_per_page");

  const bookmarksPerPageOptions = (bookmarksPerPageField?.choices || []).map(([value, label]) => ({
    value,
    label,
  }));

  const defaultCollectionOptions = (defaultCollectionField?.choices || []).map(
    ([value, label]) => ({ value, label })
  );
  const imageCollectionOptions = (imageCollectionField?.choices || []).map(([value, label]) => ({
    value,
    label,
  }));

  const initialStateRef = useRef<FieldState | null>(null);

  const buildInitial = useCallback((): FieldState => {
    const drillField = getField(formFields, "drill_intervals");
    return {
      eyeCandy,
      theme: themeField?.value || "",
      topbarAnimation: topbarAnimationField?.value || "aurora",
      background: {
        url: backgroundImageUrl || "",
        name: backgroundImageUrl ? backgroundImageName || basename(backgroundImageUrl) : "",
      },
      sidebar: {
        url: sidebarImageUrl || "",
        name: sidebarImageUrl ? sidebarImageName || basename(sidebarImageUrl) : "",
      },
      drillMutedTags: initialTags.map(t => t.toLowerCase()),
      drillIntervals: parseDrillIntervals(drillField?.value || ""),
      defaultCollection: defaultCollectionField?.value || "",
      imageCollection: imageCollectionField?.value || "",
      bookmarksPerPage: bookmarksPerPageField?.value || "50",
      instagramUsername,
      instagramPassword,
      nytimesApiKey: getField(formFields, "nytimes_api_key")?.value || "",
      googleCalendar: getField(formFields, "google_calendar")?.value || "",
      googleCalendarEmail: getField(formFields, "google_calendar_email")?.value || "",
    };
  }, []);

  if (initialStateRef.current === null) {
    initialStateRef.current = buildInitial();
  }

  const [state, setState] = useState<FieldState>(() => initialStateRef.current!);
  const [initial, setInitial] = useState<FieldState>(() => initialStateRef.current!);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(() => {
    const errors: Record<string, string[]> = {};
    for (const field of formFields) {
      if (field.errors.length > 0) errors[field.name] = field.errors;
    }
    return errors;
  });

  // Apply theme change live so the rest of the app reflects the selection
  // while the user is still deciding. Revert on unmount if they never saved.
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("color-mode", state.theme);
  }, [state.theme]);

  // Mirror the same live-preview behaviour for the top-bar animation. The
  // dispatcher in <TopBarBackground/> observes this attribute and swaps the
  // active canvas with no round-trip.
  useEffect(() => {
    document.documentElement.setAttribute("topbar-animation", state.topbarAnimation);
  }, [state.topbarAnimation]);

  const upd = useCallback(
    <K extends keyof FieldState>(key: K) =>
      (value: FieldState[K]) => {
        setJustSaved(false);
        setState(s => ({ ...s, [key]: value }));
      },
    []
  );

  const diffKeys = useMemo(() => {
    const keys: (keyof FieldState)[] = [];
    (Object.keys(state) as (keyof FieldState)[]).forEach(k => {
      if (JSON.stringify(state[k]) !== JSON.stringify(initial[k])) keys.push(k);
    });
    return keys;
  }, [state, initial]);

  const dirty = diffKeys.length > 0;

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    // axios automatically injects X-CSRFToken from the csrftoken cookie.
    const form = new FormData();

    form.append("theme", state.theme);
    form.append("topbar_animation", state.topbarAnimation);
    form.append("eye_candy", state.eyeCandy ? "true" : "false");
    form.append(
      "drill_intervals",
      state.drillIntervals.length ? state.drillIntervals.join(",") : ""
    );
    form.append("drill_tags_muted", state.drillMutedTags.join(","));
    form.append("nytimes_api_key", state.nytimesApiKey);
    form.append("google_calendar", state.googleCalendar);
    form.append("google_calendar_email", state.googleCalendarEmail);
    form.append("instagram_username", state.instagramUsername);
    form.append("instagram_password", state.instagramPassword);

    if (defaultCollectionField) {
      form.append("homepage_default_collection", state.defaultCollection);
    }
    if (imageCollectionField) {
      form.append("homepage_image_collection", state.imageCollection);
    }
    form.append("bookmarks_per_page", state.bookmarksPerPage);

    // Background image
    if (state.background.file) {
      form.append("background_image_file", state.background.file);
      form.append("background_image", state.background.name || state.background.file.name);
    } else if (!state.background.url && initial.background.url) {
      form.append("delete_background", "true");
      form.append("background_image", "");
    } else {
      form.append("background_image", initial.background.name || "");
    }

    // Sidebar image
    if (state.sidebar.file) {
      form.append("sidebar_image_file", state.sidebar.file);
      form.append("sidebar_image", state.sidebar.name || state.sidebar.file.name);
    } else if (!state.sidebar.url && initial.sidebar.url) {
      form.append("delete_sidebar", "true");
      form.append("sidebar_image", "");
    } else {
      form.append("sidebar_image", initial.sidebar.name || "");
    }

    form.append("instagram_credentials", "");

    setSaving(true);
    try {
      await axios.post(formAction, form, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        withCredentials: true,
      });
      setInitial(state);
      setFieldErrors({});
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      if (response?.status === 400 && response.data && typeof response.data === "object") {
        setFieldErrors(response.data as Record<string, string[]>);
      } else {
        setFieldErrors({ __all__: ["Failed to save preferences. Please try again."] });
      }
    } finally {
      setSaving(false);
    }
  }, [dirty, formAction, initial, saving, state, defaultCollectionField, imageCollectionField]);

  const discard = useCallback(() => {
    setState(initial);
    setFieldErrors({});
    setJustSaved(false);
  }, [initial]);

  // ⌘S / Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dirty, saving, save]);

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const tokenDisplay = authToken || "—";
  const groupList = groups
    ? groups
        .split(",")
        .map(g => g.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="prefs-app">
      <PreferencesLayout
        activeTab="main"
        prefsUrl={prefsUrl}
        passwordUrl={passwordUrl}
        pageTitle="Preferences"
        pageSubtitle="workspace defaults"
        pageDescription="Configure appearance, drills, integrations, and default views. Changes apply on save and sync across devices."
        sidebarInfo={{
          title: "Preferences",
          body: "Tune various aspects of your Bordercore experience. Changes apply instantly on save.",
        }}
      >
        {fieldErrors.__all__ && (
          <div className="prefs-errors prefs-errors-banner">
            {fieldErrors.__all__.map((e, i) => (
              <span key={i} className="err">
                {e}
              </span>
            ))}
          </div>
        )}

        <SectionCard title="Account" meta="read-only · managed by admin">
          <Row label="API token" hint="used for CLI & external integrations">
            <SecretField value={tokenDisplay} canEdit={false} />
          </Row>
          <Row label="Groups" hint="permission scopes">
            <div className="prefs-groups-row">
              {groupList.length === 0 ? (
                <span className="prefs-badge muted">● none</span>
              ) : (
                groupList.map((g, i) => (
                  <span key={g} className={`prefs-badge ${i === 0 ? "ok" : "muted"}`}>
                    ● {g}
                  </span>
                ))
              )}
            </div>
          </Row>
        </SectionCard>

        <SectionCard title="Appearance" meta="visual preferences">
          <Row label="Eye candy" hint="animations, blur, glow effects">
            <Toggle
              value={state.eyeCandy}
              onChange={upd("eyeCandy")}
              onLabel="animations on"
              offLabel="reduced motion"
            />
          </Row>
          <Row label="Theme" hint="preview shows header, accent & panel">
            <ThemePicker value={state.theme} onChange={upd("theme")} themes={themeOptions} />
          </Row>
          <Row label="Top bar animation" hint="background effect behind the bar">
            <Select
              id="id_topbar_animation"
              value={state.topbarAnimation}
              onChange={upd("topbarAnimation")}
              options={topbarAnimationOptions}
            />
          </Row>
          <Row
            label="Background image"
            hint="full-page backdrop"
            errors={fieldErrors.background_image}
          >
            <FileDrop value={state.background} onChange={upd("background")} kind="Background" />
          </Row>
          <Row label="Sidebar image" hint="left-rail artwork" errors={fieldErrors.sidebar_image}>
            <FileDrop value={state.sidebar} onChange={upd("sidebar")} kind="Sidebar" />
          </Row>
        </SectionCard>

        <SectionCard title="Drills" meta="spaced-repetition config">
          <Row label="Muted drill tags" hint="skip flashcards with these tags">
            <TagInput
              tags={state.drillMutedTags}
              onChange={upd("drillMutedTags")}
              searchUrl={tagSearchUrl}
            />
          </Row>
          <Row
            label="Drill intervals"
            hint="days between review passes"
            errors={fieldErrors.drill_intervals}
          >
            <DrillIntervals value={state.drillIntervals} onChange={upd("drillIntervals")} />
          </Row>
        </SectionCard>

        <SectionCard title="Collections" meta="default views">
          {defaultCollectionField && (
            <Row label="Default collection" hint="shown on the homepage">
              <Select
                id="id_homepage_default_collection"
                value={state.defaultCollection}
                onChange={upd("defaultCollection")}
                options={defaultCollectionOptions}
              />
            </Row>
          )}
          {imageCollectionField && (
            <Row label="Image collection" hint="source for gallery backgrounds">
              <Select
                id="id_homepage_image_collection"
                value={state.imageCollection}
                onChange={upd("imageCollection")}
                options={imageCollectionOptions}
              />
            </Row>
          )}
          <Row
            label="Bookmarks per page"
            hint="how many bookmarks load at a time"
            errors={fieldErrors.bookmarks_per_page}
          >
            <Select
              id="id_bookmarks_per_page"
              value={state.bookmarksPerPage}
              onChange={upd("bookmarksPerPage")}
              options={bookmarksPerPageOptions}
            />
          </Row>
        </SectionCard>

        <SectionCard title="Integrations" meta="external services">
          <Row label="Instagram" hint="credentials for media sync">
            <div className="prefs-integration-grid">
              <input
                className="prefs-input"
                value={state.instagramUsername}
                onChange={e => upd("instagramUsername")(e.target.value)}
                placeholder="username"
                autoComplete="off"
              />
              <SecretField
                value={state.instagramPassword}
                onChange={upd("instagramPassword")}
                placeholder="password"
              />
            </div>
          </Row>
          <Row
            label="NY Times API key"
            hint="articles & cooking endpoints"
            errors={fieldErrors.nytimes_api_key}
          >
            <SecretField value={state.nytimesApiKey} onChange={upd("nytimesApiKey")} />
          </Row>
          <Row
            label="Google Calendar"
            hint="OAuth2 credentials JSON blob"
            errors={fieldErrors.google_calendar}
          >
            <textarea
              className="prefs-input"
              spellCheck={false}
              value={state.googleCalendar}
              onChange={e => upd("googleCalendar")(e.target.value)}
            />
          </Row>
          <Row
            label="Google Calendar email"
            hint="primary calendar address"
            errors={fieldErrors.google_calendar_email}
          >
            <input
              className="prefs-input"
              value={state.googleCalendarEmail}
              onChange={e => upd("googleCalendarEmail")(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </Row>
        </SectionCard>
      </PreferencesLayout>

      <SaveBar
        visible={dirty || justSaved}
        dirty={dirty}
        changedCount={diffKeys.length}
        saving={saving}
        justSaved={justSaved}
        onSave={save}
        onDiscard={discard}
      />
    </div>
  );
}

export default PreferencesPage;
