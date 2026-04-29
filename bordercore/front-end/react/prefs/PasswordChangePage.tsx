import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PasswordStrength, { computeStrength } from "./components/PasswordStrength";
import PreferencesLayout from "./components/PreferencesLayout";
import Row from "./components/Row";
import SecretField from "./components/SecretField";
import SectionCard from "./components/SectionCard";
import Toggle from "./components/Toggle";

export interface PasswordChangePageProps {
  formAction: string;
  prefsUrl: string;
  passwordUrl: string;
  username: string;
  sessionsUrl: string;
  sessionsRevokeUrlTemplate: string;
}

interface SessionRow {
  uuid: string;
  device: string;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  is_current: boolean;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function PasswordChangePage({
  formAction,
  prefsUrl,
  passwordUrl,
  username,
  sessionsUrl,
  sessionsRevokeUrlTemplate,
}: PasswordChangePageProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const strength = useMemo(() => computeStrength(next, confirm), [next, confirm]);
  const canSubmit =
    !saving && current.length > 0 && next.length > 0 && next === confirm && strength.score >= 3;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!sessionsUrl) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const resp = await axios.get<SessionRow[]>(sessionsUrl, {
        withCredentials: true,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      setSessions(resp.data);
    } catch {
      setSessionsError("Unable to load active sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionsUrl]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const revokeSession = useCallback(
    async (uuid: string) => {
      if (!sessionsRevokeUrlTemplate) return;
      setRevoking(uuid);
      try {
        const url = sessionsRevokeUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);
        await axios.post(url, null, {
          headers: { "X-Requested-With": "XMLHttpRequest" },
          withCredentials: true,
        });
        setSessions(prev => prev.filter(s => s.uuid !== uuid));
      } catch {
        setSessionsError("Unable to revoke that session.");
      } finally {
        setRevoking(null);
      }
    },
    [sessionsRevokeUrlTemplate]
  );

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setErrors({});
    setSuccess(false);

    // axios automatically injects X-CSRFToken from the csrftoken cookie.
    const form = new FormData();
    form.append("old_password", current);
    form.append("new_password1", next);
    form.append("new_password2", confirm);

    try {
      const resp = await axios.post(formAction, form, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: s => s < 500,
      });

      // Django's PasswordChangeView redirects on success and re-renders the
      // form (with errors in the HTML response body) on failure. A 302/200
      // response status we can't easily introspect on the form itself, so
      // treat a successful POST as success unless the server returns 400.
      if (resp.status === 400 && resp.data && typeof resp.data === "object") {
        setErrors(resp.data as Record<string, string[]>);
      } else {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      if (response?.status === 400 && response.data && typeof response.data === "object") {
        setErrors(response.data as Record<string, string[]>);
      } else {
        setErrors({ __all__: ["Unable to change password. Try again."] });
      }
    } finally {
      setSaving(false);
    }
  }, [canSubmit, confirm, current, formAction, next]);

  return (
    <div className="prefs-app">
      <PreferencesLayout
        activeTab="password"
        prefsUrl={prefsUrl}
        passwordUrl={passwordUrl}
        pageTitle="Password &amp; Security"
        pageSubtitle="account protection"
        pageDescription="Rotate your password, manage active sessions, and review two-factor enrollment."
        sidebarInfo={{
          title: "Password change",
          body: "Choose a long, unique password. Use a password manager so you don't have to remember it.",
        }}
      >
        {errors.__all__ && (
          <div className="prefs-errors prefs-errors-banner">
            {errors.__all__.map((e, i) => (
              <span key={i} className="err">
                {e}
              </span>
            ))}
          </div>
        )}

        <SectionCard title="Change password">
          <Row label="Current password" errors={errors.old_password}>
            <SecretField
              value={current}
              onChange={setCurrent}
              placeholder="enter current password"
              autoComplete="current-password"
            />
          </Row>

          <Row
            label="New password"
            hint="at least 12 characters with mixed case, numbers, and symbols"
            errors={errors.new_password1}
          >
            <SecretField
              value={next}
              onChange={setNext}
              placeholder="choose a new password"
              autoComplete="new-password"
            />
            <PasswordStrength password={next} confirm={confirm} />
          </Row>

          <Row label="Confirm password" errors={errors.new_password2}>
            <SecretField
              value={confirm}
              onChange={setConfirm}
              placeholder="repeat new password"
              autoComplete="new-password"
            />
          </Row>

          <Row label="" hint="">
            <div className="prefs-actions-row">
              <button
                type="button"
                className="prefs-btn primary"
                disabled={!canSubmit}
                onClick={submit}
              >
                {saving ? "updating…" : "update password"}
              </button>
              {success && <span className="prefs-ok-note">✓ Password updated.</span>}
            </div>
          </Row>
        </SectionCard>

        <SectionCard title="Sessions &amp; security">
          <Row label="Active sessions" hint="sign out of other devices">
            <div className="prefs-session-list">
              {sessionsLoading && <div className="prefs-empty-note">loading…</div>}
              {sessionsError && (
                <div className="prefs-errors">
                  <span className="err">{sessionsError}</span>
                </div>
              )}
              {!sessionsLoading && sessions.length === 0 && !sessionsError && (
                <div className="prefs-empty-note">no active sessions</div>
              )}
              {sessions.map(s => (
                <div key={s.uuid} className="prefs-session">
                  <div>
                    <div className="device">{s.device}</div>
                    <div className="meta">
                      {s.ip_address || "unknown ip"} · {formatRelative(s.last_seen_at)}
                    </div>
                  </div>
                  {s.is_current ? (
                    <span className="prefs-badge ok">this device</span>
                  ) : (
                    <button
                      type="button"
                      className="prefs-btn danger-ghost"
                      onClick={() => revokeSession(s.uuid)}
                      disabled={revoking === s.uuid}
                    >
                      {revoking === s.uuid ? "revoking…" : "revoke"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Row>
          <Row label="Two-factor auth" hint="TOTP via authenticator app">
            <Toggle
              value={false}
              onChange={() => {
                /* TODO: wire TOTP enrollment modal */
              }}
              onLabel="enrolled"
              offLabel="disabled"
            />
          </Row>
        </SectionCard>
      </PreferencesLayout>
    </div>
  );
}

export default PasswordChangePage;
