import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfo } from "@fortawesome/free-solid-svg-icons";

interface PasswordChangePageProps {
  formAction: string;
  csrfToken: string;
  prefsUrl: string;
}

export function PasswordChangePage({
  formAction,
  csrfToken,
  prefsUrl,
}: PasswordChangePageProps) {
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
              <h6 className="text-secondary">Password change</h6>
            </div>
            <div>
              <span>Change your password</span> by first verifying your existing
              password, then entering your new password with confirmation.
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="col-lg-9">
        <div className="card-grid ms-3 me-3">
          {/* Tab navigation */}
          <ul
            className="nav nav-tabs justify-content-center mb-4"
            id="v-pills-tab"
            role="tablist"
            aria-orientation="vertical"
          >
            <li className="nav-item">
              <a
                className="nav-link"
                href={prefsUrl}
                role="tab"
                aria-controls="v-pills-main"
                aria-selected="false"
              >
                Main
              </a>
            </li>
            <li className="nav-item">
              <a
                className="nav-link active"
                href={formAction}
                role="tab"
                aria-controls="v-pills-password"
                aria-selected="true"
              >
                Password
              </a>
            </li>
          </ul>

          {/* Password change form */}
          <form encType="multipart/form-data" action={formAction} method="post">
            <input
              type="hidden"
              name="csrfmiddlewaretoken"
              value={csrfToken}
            />

            <div className="row mb-3">
              <label
                className="fw-bold col-lg-3 col-form-label text-end"
                htmlFor="id_old_password"
              >
                Old Password
              </label>
              <div className="col-lg-6">
                <input
                  type="password"
                  name="old_password"
                  className="form-control"
                  autoFocus
                  required
                  id="id_old_password"
                />
              </div>
            </div>

            <div className="row mb-3">
              <label
                className="fw-bold col-lg-3 col-form-label text-end"
                htmlFor="id_new_password1"
              >
                New Password
              </label>
              <div className="col-lg-6">
                <input
                  type="password"
                  name="new_password1"
                  className="form-control"
                  required
                  id="id_new_password1"
                />
              </div>
            </div>

            <div className="row mb-3">
              <label
                className="fw-bold col-lg-3 col-form-label text-end"
                htmlFor="id_new_password2"
              >
                New Password Confirmation
              </label>
              <div className="col-lg-6">
                <input
                  type="password"
                  name="new_password2"
                  className="form-control"
                  required
                  id="id_new_password2"
                />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-lg-3 offset-lg-3">
                <button className="btn btn-primary" type="submit">
                  Update
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PasswordChangePage;
