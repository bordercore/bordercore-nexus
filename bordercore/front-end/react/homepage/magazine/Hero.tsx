import React, { useEffect, useRef, useState } from "react";
import { fillUrlTemplate, formatIssueDate, greetingForHour } from "./utils";
import type { DefaultCollection, RandomImageInfo } from "../types";

interface HeroProps {
  randomImageInfo: RandomImageInfo | null;
  defaultCollection: DefaultCollection | null;
  blobDetailUrlTemplate: string;
  collectionDetailUrlTemplate: string;
  userName: string;
  randomImageUrl: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function preloadImage(src: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort);
    img.onload = () => {
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load ${src}`));
    };
    img.src = src;
  });
}

export function Hero({
  randomImageInfo,
  defaultCollection,
  blobDetailUrlTemplate,
  collectionDetailUrlTemplate,
  userName,
  randomImageUrl,
}: HeroProps) {
  const [issue, setIssue] = useState(() => formatIssueDate());
  const [currentImage, setCurrentImage] = useState<RandomImageInfo | null>(randomImageInfo);
  const [incomingImage, setIncomingImage] = useState<RandomImageInfo | null>(null);
  const [incomingLoaded, setIncomingLoaded] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleError, setShuffleError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setIssue(formatIssueDate()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Mount the incoming image at opacity:0, then promote to opacity:1 on the
  // next frame so the CSS transition has a starting value to interpolate from.
  useEffect(() => {
    if (!incomingImage) return;
    const id = window.requestAnimationFrame(() => setIncomingLoaded(true));
    return () => window.cancelAnimationFrame(id);
  }, [incomingImage]);

  const handleShuffle = async () => {
    if (isShuffling || !randomImageUrl) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsShuffling(true);
    setShuffleError(null);

    try {
      const resp = await fetch(randomImageUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as { image: RandomImageInfo | null };

      if (!body.image) {
        setShuffleError("No images available");
        setIsShuffling(false);
        return;
      }

      await preloadImage(body.image.url, controller.signal);

      if (prefersReducedMotion()) {
        setCurrentImage(body.image);
        setIsShuffling(false);
        return;
      }

      // Reset the loaded flag BEFORE mounting the new img so it mounts at
      // opacity 0; the effect below flips it back to true on the next frame
      // to trigger the crossfade. Without this reset, a second shuffle would
      // mount the new img already at opacity 1 and never fire transitionend.
      setIncomingLoaded(false);
      setIncomingImage(body.image);
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      setShuffleError("Couldn't load a new image");
      setIsShuffling(false);
    }
  };

  const handleIncomingTransitionEnd = (e: React.TransitionEvent<HTMLImageElement>) => {
    if (e.propertyName !== "opacity" || !incomingImage) return;
    setCurrentImage(incomingImage);
    setIncomingImage(null);
    setIncomingLoaded(false);
    setIsShuffling(false);
  };

  const greeting = greetingForHour(issue.hour);
  const heroClass = `mag-hero${isShuffling && !incomingImage ? " is-shuffling" : ""}`;

  return (
    <div className={heroClass}>
      {currentImage ? (
        <img
          key={currentImage.uuid}
          className={`mag-hero-img${incomingImage ? " mag-hero-img-outgoing" : ""}`}
          src={currentImage.url}
          alt={currentImage.name}
        />
      ) : (
        <div className="mag-hero-fallback" aria-hidden="true" />
      )}

      {incomingImage && (
        <img
          key={`incoming-${incomingImage.uuid}`}
          className={`mag-hero-img mag-hero-img-incoming${incomingLoaded ? " mag-hero-img-loaded" : ""}`}
          src={incomingImage.url}
          alt={incomingImage.name}
          onTransitionEnd={handleIncomingTransitionEnd}
        />
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
            {currentImage ? (
              <>
                <div className="mag-hero-image-name">
                  <a href={fillUrlTemplate(blobDetailUrlTemplate, currentImage.uuid)}>
                    {currentImage.name}
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
            {shuffleError && (
              <div className="mag-hero-image-meta mag-hero-shuffle-error">{shuffleError}</div>
            )}
          </div>
          <div className="mag-hero-actions">
            <button
              type="button"
              className="mag-hero-link"
              onClick={handleShuffle}
              disabled={isShuffling}
            >
              {isShuffling ? "shuffling…" : "shuffle"}
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
