import React, { useEffect, useState } from "react";
import { fillUrlTemplate, formatIssueDate, greetingForHour } from "./utils";
import type { DefaultCollection, RandomImageInfo } from "../types";

interface HeroProps {
  randomImageInfo: RandomImageInfo | null;
  defaultCollection: DefaultCollection | null;
  blobDetailUrlTemplate: string;
  collectionDetailUrlTemplate: string;
  userName: string;
}

export function Hero({
  randomImageInfo,
  defaultCollection,
  blobDetailUrlTemplate,
  collectionDetailUrlTemplate,
  userName,
}: HeroProps) {
  const [issue, setIssue] = useState(() => formatIssueDate());

  useEffect(() => {
    const id = window.setInterval(() => setIssue(formatIssueDate()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleShuffle = () => {
    window.location.reload();
  };

  const greeting = greetingForHour(issue.hour);

  return (
    <div className="mag-hero">
      {randomImageInfo ? (
        <img className="mag-hero-img" src={randomImageInfo.url} alt={randomImageInfo.name} />
      ) : (
        <div className="mag-hero-fallback" aria-hidden="true" />
      )}

      <div className="mag-hero-overlay">
        <div className="mag-hero-top">
          <div>
            <div className="mag-ucase mag-issue-line">
              vol. {issue.issueNumber} · {issue.iso}
            </div>
            <div className="mag-masthead">
              {greeting}
              <br />
              <span className="mag-masthead-accent">{userName}</span>
            </div>
          </div>
          <div className="mag-hero-edition mag-mono">
            <div>{issue.weekday} EDITION</div>
            <div className="mag-hero-edition-time">{issue.time}</div>
          </div>
        </div>

        <div className="mag-hero-bottom">
          <div>
            <div className="mag-ucase is-cyan">image of the day</div>
            {randomImageInfo ? (
              <>
                <div className="mag-hero-image-name">
                  <a href={fillUrlTemplate(blobDetailUrlTemplate, randomImageInfo.uuid)}>
                    {randomImageInfo.name}
                  </a>
                </div>
                {defaultCollection && (
                  <div className="mag-hero-image-meta">
                    from{" "}
                    <a href={fillUrlTemplate(collectionDetailUrlTemplate, defaultCollection.uuid)}>
                      {defaultCollection.name}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="mag-hero-image-name">No image yet</div>
            )}
          </div>
          <div className="mag-hero-actions">
            <button type="button" className="mag-hero-link" onClick={handleShuffle}>
              shuffle
            </button>
            {defaultCollection && (
              <a
                className="mag-hero-link"
                href={fillUrlTemplate(collectionDetailUrlTemplate, defaultCollection.uuid)}
              >
                view collection →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
