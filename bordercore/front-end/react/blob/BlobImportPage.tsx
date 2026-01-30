import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

interface Message {
  body: string;
  variant: string;
  autoHide: boolean;
}

interface BlobImportPageProps {
  staticUrl: string;
  importUrl: string;
  csrfToken: string;
  messages: Message[];
  initialUrl?: string;
}

export function BlobImportPage({
  staticUrl,
  importUrl,
  csrfToken,
  messages,
  initialUrl = "",
}: BlobImportPageProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    const url = urlInputRef.current?.value || "";
    if (url === "") {
      e.preventDefault();
      return;
    }
    setIsProcessing(true);
    // Form submits naturally - no preventDefault
  };

  return (
    <div className="row g-0 h-100 mx-2">
      <div className="col-lg-3 d-flex flex-column">
        <div className="left-panel-gradient card-body d-flex flex-column backdrop-filter">
          <h5>Import blobs from external sites</h5>
          <hr className="divider" />
          <div>
            Sites supported
            <ul className="list-unstyled p-2">
              <li className="d-flex align-items-center p-2">
                <div className="sites-supported-icon-container">
                  <img
                    src={`${staticUrl}img/instagram.ico`}
                    width="38"
                    height="38"
                    alt="Instagram"
                  />
                </div>
                <strong className="ms-2">Instagram</strong>
              </li>
              <li className="d-flex align-items-center p-2">
                <div className="sites-supported-icon-container">
                  <img
                    src={`${staticUrl}img/artstation.ico`}
                    width="38"
                    height="38"
                    alt="Artstation"
                  />
                </div>
                <strong className="ms-2">Artstation</strong>
              </li>
              <li className="d-flex align-items-start p-2">
                <div className="sites-supported-icon-container">
                  <img
                    src={`${staticUrl}img/nytimes.ico`}
                    width="38"
                    height="38"
                    alt="New York Times"
                  />
                </div>
                <div className="d-flex flex-column ms-2">
                  <strong>New York Times</strong>
                  <div className="text-small text-secondary">metadata only</div>
                </div>
              </li>
              <li className="d-flex align-items-center p-2">
                <div className="sites-supported-icon-container">
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill="#6c757d"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
                <strong className="ms-2">Generic Article</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        {messages.map((msg, index) => (
          <div key={index} className={`message-${msg.variant} card-body ms-3 p-3`}>
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
            {msg.body}
          </div>
        ))}

        <div className="card-body backdrop-filter">
          <div className="d-flex align-items-center">
            <div id="blob-import-icon" className="me-3">
              <img
                height="80"
                width="80"
                src={`${staticUrl}img/website.jpg`}
                alt="Website"
              />
            </div>

            <div className="w-100">
              <form
                id="import-blob-form"
                method="post"
                action={importUrl}
                onSubmit={handleSubmit}
              >
                <input
                  type="hidden"
                  name="csrfmiddlewaretoken"
                  value={csrfToken}
                />

                <div className="row">
                  <h3 className="col-lg-12 mb-4">
                    Enter the url representing the blob you'd like to import.
                  </h3>
                </div>

                <div className="row">
                  <div className="col-lg-12">
                    <input
                      ref={urlInputRef}
                      className="form-control"
                      name="url"
                      defaultValue={initialUrl}
                      type="text"
                      placeholder="Url"
                      autoComplete="off"
                    />
                    <div className="d-flex mt-3">
                      <button type="submit" className="btn btn-primary">
                        Import
                      </button>
                      <div
                        className={`spinner-border ms-3 text-secondary ${
                          isProcessing ? "" : "d-none"
                        }`}
                        role="status"
                      >
                        <span className="sr-only">Loading...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlobImportPage;
