import React from "react";

interface UrlEntry {
  url: string;
  domain: string;
}

interface UrlsSectionProps {
  urls: UrlEntry[];
}

export function UrlsSection({ urls }: UrlsSectionProps) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="bd-rail-section">
      <h3>
        URLs <span className="bd-count">{urls.length}</span>
      </h3>
      <div className="bd-urls">
        {urls.map((u, i) => (
          <a
            key={i}
            className="bd-url"
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            title={u.url}
          >
            <span className="favicon">{(u.domain || "?").charAt(0).toUpperCase()}</span>
            <span className="domain">{u.domain || u.url}</span>
            <span className="path">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default UrlsSection;
