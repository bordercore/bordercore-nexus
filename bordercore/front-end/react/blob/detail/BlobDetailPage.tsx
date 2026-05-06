import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import markdownit from "markdown-it";
import DOMPurify from "dompurify";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-markdown";
import hotkeys from "hotkeys-js";

import { doGet, doPost, EventBus } from "../../utils/reactUtils";
import { Hero } from "./Hero";
import { Rail } from "./Rail";
import { FullscreenReader } from "./FullscreenReader";
import { BackrefsSection } from "./sections/BackrefsSection";
import type { BlobDetailPageProps, Collection, ElasticsearchInfo, BackReference } from "../types";

const RETRY_INTERVALS = [1000, 3000, 6000];

// DOMPurify keeps <a name> attributes via ADD_ATTR; needed so ToC scroll-spy
// anchors survive sanitization.
const PURIFY_CONFIG = {
  ADD_ATTR: ["name", "target"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
};

// Add a copy button to each code block after Prism highlighting.
Prism.hooks.add("complete", env => {
  const code = env.element as HTMLElement;
  const pre = code.parentNode as HTMLElement;
  if (!pre || pre.tagName !== "PRE") return;
  if (pre.parentElement?.classList.contains("code-block-wrapper")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "code-block-wrapper";
  pre.parentNode?.replaceChild(wrapper, pre);
  wrapper.appendChild(pre);

  const button = document.createElement("button");
  button.className = "copy-button";
  button.setAttribute("type", "button");
  const linkSpan = document.createElement("span");
  linkSpan.textContent = "Copy";
  button.appendChild(linkSpan);
  button.addEventListener("click", () => {
    if (navigator.clipboard) {
      const textContent = code.textContent?.replaceAll(/^\$ /gm, "") || "";
      navigator.clipboard.writeText(textContent);
      linkSpan.textContent = "Copied!";
      setTimeout(() => {
        linkSpan.textContent = "Copy";
      }, 2000);
    }
  });
  wrapper.appendChild(button);
});

export function BlobDetailPage({
  blob: initialBlob,
  urls,
  blobUrls,
  initialCollectionList,
  initialElasticsearchInfo,
  backReferences: initialBackRefs,
  tree,
  metadataMisc,
  nodeList,
  isPinnedNote: initialIsPinnedNote,
}: BlobDetailPageProps) {
  const [blob, setBlob] = useState(initialBlob);
  const [collections, setCollections] = useState<Collection[]>(initialCollectionList);
  const [backRefs] = useState<BackReference[]>(initialBackRefs);
  const [elasticsearchInfo, setElasticsearchInfo] = useState<ElasticsearchInfo | null>(
    initialElasticsearchInfo
  );
  const [isPinnedNote, setIsPinnedNote] = useState(initialIsPinnedNote);
  const [contentRoot, setContentRoot] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const markdown = useMemo(() => markdownit(), []);

  // Wait up to ~10s for Elasticsearch to index the blob, retry-with-backoff.
  useEffect(() => {
    if (initialElasticsearchInfo) return;

    let attempts = 0;
    const fetchInfo = () => {
      if (attempts >= RETRY_INTERVALS.length) return;
      doGet(
        urls.getElasticsearchInfo,
        response => {
          if (response.data.info && Object.keys(response.data.info).length > 0) {
            setElasticsearchInfo(response.data.info);
          } else {
            attempts++;
            if (attempts < RETRY_INTERVALS.length) {
              setTimeout(fetchInfo, RETRY_INTERVALS[attempts]);
            }
          }
        },
        "Error getting blob info"
      );
    };
    setTimeout(fetchInfo, RETRY_INTERVALS[0]);
  }, [initialElasticsearchInfo, urls.getElasticsearchInfo]);

  useEffect(() => {
    if (
      blob.mathSupport &&
      typeof window !== "undefined" &&
      (window as any).MathJax?.typesetPromise
    ) {
      (window as any).MathJax.typesetPromise().catch((err: Error) => {
        console.error("MathJax typeset error:", err);
      });
    }
  }, [blob.mathSupport, blob.content]);

  useEffect(() => {
    if (blob.content) Prism.highlightAll();
  }, [blob.content]);

  useEffect(() => {
    hotkeys("alt+a", event => {
      event.preventDefault();
      const btn = document.querySelector<HTMLButtonElement>(
        ".bd-rail-section .bd-section-act[aria-label='Add to collection']"
      );
      btn?.click();
    });
    return () => hotkeys.unbind("alt+a");
  }, []);

  // Markdown is rendered server-side by the user for their own data; we still
  // sanitize defensively so a paste from external sources can't smuggle XSS.
  const renderedContent = useMemo(() => {
    if (!blob.content) return "";
    const html = markdown.render(blob.content);
    const withAnchors = html.replace(/(%#@!(\d+)!@#%)/g, "<a name='section_$2'></a>");
    return DOMPurify.sanitize(withAnchors, PURIFY_CONFIG);
  }, [blob.content, markdown]);

  const renderedNote = useMemo(() => {
    if (!blob.note) return "";
    return DOMPurify.sanitize(markdown.render(blob.note), PURIFY_CONFIG);
  }, [blob.note, markdown]);

  const handlePinToggle = useCallback(() => {
    const payload: Record<string, string> = { uuid: blob.uuid };
    if (isPinnedNote) payload.remove = "true";
    doPost(urls.pinNote, payload, () => setIsPinnedNote(!isPinnedNote));
  }, [blob.uuid, isPinnedNote, urls.pinNote]);

  const handleTitleSaved = useCallback((newName: string) => {
    setBlob(prev => ({ ...prev, name: newName }));
  }, []);

  const refreshCollections = useCallback(() => {
    doGet(`${urls.collectionSearch}?blob_uuid=${blob.uuid}`, response => {
      setCollections(
        (response.data || []).map((c: any) => ({
          uuid: c.uuid,
          name: c.name,
          url: c.url,
          coverUrl: c.cover_url,
          numObjects: c.num_objects,
          note: c.note || "",
        }))
      );
    });
  }, [urls.collectionSearch, blob.uuid]);

  const refreshBackRefs = useCallback(() => {
    EventBus.$emit("toast", { body: "Backref linked — refresh to see it" });
  }, []);

  return (
    <div className="bd-page">
      <main className="bd-shell">
        <Rail
          blob={blob}
          urls={urls}
          treeNodes={tree.nodes || []}
          contentRoot={contentRoot}
          collections={collections}
          backRefs={backRefs}
          elasticsearchInfo={elasticsearchInfo}
          metadataMisc={metadataMisc}
          blobUrls={blobUrls}
          nodeList={nodeList}
          onCollectionsChanged={refreshCollections}
          onBackrefsChanged={refreshBackRefs}
        />

        <div className="bd-main">
          <Hero
            blob={blob}
            urls={urls}
            isPinnedNote={isPinnedNote}
            onPinToggle={handlePinToggle}
            onTitleSaved={handleTitleSaved}
            onEnterFullscreen={() => setIsFullscreen(true)}
          />

          {blob.note && (
            <div className="bd-note" dangerouslySetInnerHTML={{ __html: renderedNote }} />
          )}

          {blob.isVideo && blob.fileUrl && (
            <video className="bd-video" controls>
              <source src={blob.fileUrl} type="video/mp4" />
            </video>
          )}

          {(blob.isImage || blob.isPdf) && blob.coverUrl && (
            <div className="bd-cover">
              <img src={blob.coverUrl} alt={blob.name} />
            </div>
          )}

          {blob.isPdf && urls.pdfViewer && (
            <a className="bd-iconbtn primary" href={urls.pdfViewer} role="button">
              View PDF
            </a>
          )}

          {elasticsearchInfo?.contentType === "SQLite Database" && urls.sqlPlayground && (
            <a
              className="bd-iconbtn primary"
              href={`${urls.sqlPlayground}?sql_db_uuid=${blob.uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              role="button"
            >
              SQL Playground
            </a>
          )}

          {blob.content && (
            <article
              className="bd-content"
              ref={setContentRoot}
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          )}

          {backRefs.length > 0 && (
            <BackrefsSection
              blobUuid={blob.uuid}
              backRefs={backRefs}
              addRelatedObjectUrl={urls.addRelatedObject}
              searchNamesUrl={urls.searchNames}
              createBlobUrl={urls.create}
              asFooter
              onChanged={() => {}}
            />
          )}
        </div>
      </main>

      {isFullscreen && (
        <FullscreenReader
          blob={blob}
          renderedContent={renderedContent}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}

export default BlobDetailPage;
