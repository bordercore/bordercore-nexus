import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock } from "@fortawesome/free-solid-svg-icons";

interface LoginPageProps {
  message?: string;
  initialUsername: string;
  loginUrl: string;
  nextUrl: string;
  csrfToken: string;
}

export function LoginPage({
  message,
  initialUsername,
  loginUrl,
  nextUrl,
  csrfToken,
}: LoginPageProps) {
  return (
    <div className="container d-flex justify-content-center align-items-center h-100">
      <div className="animated-gradient-box jumbotron p-5 text-white bg-dark rounded-3">
        <div className="position-relative h-100 w-100">
          {message && <p className="alert alert-danger">{message}</p>}
          <form action={loginUrl} method="post" className="position-absolute w-75 mx-auto">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="row mb-3 align-items-center">
              <label className="form-label col-lg-3 text-end" htmlFor="username">
                Username
              </label>
              <div className="col-lg-9">
                <div className="input-group">
                  <span className="input-group-text">
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    className="form-control"
                    type="text"
                    name="username"
                    defaultValue={initialUsername}
                    id="username"
                    placeholder="Username"
                    autoComplete="username"
                  />
                </div>
              </div>
            </div>
            <div className="row mb-3 align-items-center">
              <label className="form-label col-lg-3 text-end" htmlFor="password">
                Password
              </label>
              <div className="col-lg-9">
                <div className="input-group">
                  <span className="input-group-text">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    className="form-control"
                    type="password"
                    name="password"
                    id="password"
                    placeholder="Password"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </div>
            <div className="row mb-4">
              <label className="col-form-label col-lg-3"></label>
              <div className="col-auto input-group justify-content-end">
                <button type="submit" className="btn btn-lg btn-primary">
                  Sign in
                </button>
              </div>
            </div>
            <hr />
            <div id="login-quote" className="row mb-3">
              <small>
                <em>
                  A lone cyberpunk solo navigating the shadowy digital byways against the
                  pulsating neon backdrop of data streams and code, searching for order and
                  meaning.
                </em>
              </small>
            </div>
            <input type="hidden" name="next" value={nextUrl} />
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
