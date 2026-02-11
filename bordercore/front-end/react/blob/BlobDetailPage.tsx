import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencilAlt,
  faPlus,
  faFileAlt,
  faClone,
  faThumbtack,
  faCopy,
  faTimes,
  faDownload,
  faLink,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { faAws } from "@fortawesome/free-brands-svg-icons";
import markdownit from "markdown-it";
import hotkeys from "hotkeys-js";
import axios from "axios";

import { Card } from "../common/Card";
import { DropDownMenu, DropDownMenuHandle } from "../common/DropDownMenu";
import { RelatedObjects } from "../common/RelatedObjects";
import { BackReferences } from "../common/BackReferences";
import { ObjectSelectModal } from "../common/ObjectSelectModal";
import { TreeMenuRoot } from "../common/TreeMenu";
import { BlobDetailCover } from "./BlobDetailCover";
import { CollectionsCard } from "./CollectionsCard";
import { AddToCollectionModal, AddToCollectionModalHandle } from "./AddToCollectionModal";
import { doGet, doPost, EventBus } from "../utils/reactUtils";
import type { BlobDetailPageProps, Collection, ElasticsearchInfo } from "./types";

const RETRY_INTERVALS = [1000, 3000, 6000];

export function BlobDetailPage({
  blob,
  urls,
  blobUrls,
  initialCollectionList,
  initialElasticsearchInfo,
  backReferences,
  tree,
  metadataMisc,
  nodeList,
  isPinnedNote: initialIsPinnedNote,
  isAdmin,
  showMetadata,
  mediaUrl,
}: BlobDetailPageProps) {
  const [collectionList, setCollectionList] = useState<Collection[]>(initialCollectionList);
  const [elasticsearchInfo, setElasticsearchInfo] = useState<ElasticsearchInfo | null>(
    initialElasticsearchInfo
  );
  const [isPinnedNote, setIsPinnedNote] = useState(initialIsPinnedNote);

  const addToCollectionModalRef = useRef<AddToCollectionModalHandle>(null);
  const objectSelectModalRef = useRef<{ open: () => void } | null>(null);
  const relatedObjectsRef = useRef<{ refresh: () => void } | null>(null);
  const dropdownMenuRef = useRef<DropDownMenuHandle>(null);

  const markdown = useMemo(() => markdownit(), []);

  // Elasticsearch info retry logic
  useEffect(() => {
    if (initialElasticsearchInfo) return;

    let attempts = 0;
    const fetchInfo = () => {
      if (attempts >= RETRY_INTERVALS.length) return;

      console.log(`Retrieving blob info, attempt #${attempts + 1}`);
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

  // MathJax integration
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

  // Hotkey support
  useEffect(() => {
    hotkeys("alt+a", event => {
      event.preventDefault();
      addToCollectionModalRef.current?.open();
    });

    return () => {
      hotkeys.unbind("alt+a");
    };
  }, []);

  const getNote = useCallback(() => {
    if (!blob.note) return "";
    return markdown.render(blob.note);
  }, [blob.note, markdown]);

  const getContent = useCallback(() => {
    if (!blob.content) return "";
    const content = markdown.render(blob.content);
    // Replace section markers with anchor tags
    return content.replace(/(%#@!(\d+)!@#%)/g, "<a name='section_$2'></a>");
  }, [blob.content, markdown]);

  const handleDelete = useCallback(() => {
    if (!confirm("Are you sure you want to delete this blob?")) return;

    axios
      .delete(urls.delete)
      .then(() => {
        window.location.href = urls.list;
      })
      .catch(error => {
        EventBus.$emit("toast", {
          title: "Error",
          body: `Error deleting blob: ${error}`,
          variant: "danger",
        });
        console.error(error);
      });
  }, [urls.delete, urls.list]);

  const handlePinNote = useCallback(() => {
    const payload: Record<string, string> = { uuid: blob.uuid };
    if (isPinnedNote) {
      payload.remove = "true";
    }

    doPost(urls.pinNote, payload, () => {
      setIsPinnedNote(!isPinnedNote);
    });
  }, [blob.uuid, isPinnedNote, urls.pinNote]);

  const handleCopySha1sum = useCallback(() => {
    if (blob.sha1sum) {
      navigator.clipboard.writeText(blob.sha1sum);
      EventBus.$emit("toast", {
        body: "Sha1sum copied to clipboard",
      });
      dropdownMenuRef.current?.close();
    }
  }, [blob.sha1sum]);

  const handleAddToCollection = useCallback(() => {
    addToCollectionModalRef.current?.open();
  }, []);

  const refreshCollectionList = useCallback(() => {
    doGet(
      `${urls.collectionSearch}?blob_uuid=${blob.uuid}`,
      response => {
        // Transform snake_case API response to camelCase
        const transformedList = response.data.map((c: any) => ({
          uuid: c.uuid,
          name: c.name,
          url: c.url,
          coverUrl: c.cover_url,
          numObjects: c.num_objects,
          note: c.note || "",
        }));
        setCollectionList(transformedList);
      },
      "Error getting collection list"
    );
  }, [urls.collectionSearch, blob.uuid]);

  const handleObjectAdd = useCallback(
    (objectInfo: any) => {
      doPost(
        urls.addRelatedObject,
        {
          node_type: "blob",
          node_uuid: blob.uuid,
          object_uuid: objectInfo.uuid,
        },
        () => {
          relatedObjectsRef.current?.refresh();
        }
      );
    },
    [urls.addRelatedObject, blob.uuid]
  );

  const openObjectSelectModal = useCallback(() => {
    objectSelectModalRef.current?.open();
  }, []);

  const pinnedButtonValue = isPinnedNote ? "Unpin note" : "Pin Note";

  // Build dropdown menu items
  const dropdownItems = (
    <ul className="dropdown-menu-list">
      <li>
        <a className="dropdown-item" href={urls.edit}>
          <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" />
          Edit
        </a>
      </li>
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            handleAddToCollection();
          }}
        >
          <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
          Add to Collection
        </a>
      </li>
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            openObjectSelectModal();
          }}
        >
          <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
          New Related Object
        </a>
      </li>
      <li>
        <a className="dropdown-item" href={`${urls.create}?linked_blob_uuid=${blob.uuid}`}>
          <FontAwesomeIcon icon={faFileAlt} className="text-primary me-3" />
          Link to New Blob
        </a>
      </li>
      <li>
        <a className="dropdown-item" href={urls.clone}>
          <FontAwesomeIcon icon={faClone} className="text-primary me-3" />
          Clone Blob
        </a>
      </li>
      {blob.isNote && (
        <li>
          <a
            className="dropdown-item"
            href="#"
            onClick={e => {
              e.preventDefault();
              handlePinNote();
            }}
          >
            <FontAwesomeIcon icon={faThumbtack} className="text-primary me-3" />
            {pinnedButtonValue}
          </a>
        </li>
      )}
      {blob.sha1sum && isAdmin && (
        <>
          <li>
            <a
              className="dropdown-item"
              href="#"
              onClick={e => {
                e.preventDefault();
                handleCopySha1sum();
              }}
            >
              <FontAwesomeIcon icon={faCopy} className="text-primary me-3" />
              Copy Sha1sum
            </a>
          </li>
          {urls.awsUrl && (
            <li>
              <a className="dropdown-item" href={urls.awsUrl}>
                <FontAwesomeIcon icon={faAws} className="text-primary me-3" />
                S3 Link
              </a>
            </li>
          )}
        </>
      )}
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <FontAwesomeIcon icon={faTimes} className="text-primary me-3" />
          Delete
        </a>
      </li>
    </ul>
  );

  return (
    <div className="blob-detail-page scrollable-panel-container row g-0 align-items-start h-100 mx-2">
      {/* Object Select Modal */}
      <ObjectSelectModal
        ref={objectSelectModalRef}
        searchObjectUrl={urls.searchNames}
        title="Select Object"
        onSelectObject={handleObjectAdd}
      />

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        ref={addToCollectionModalRef}
        blobUuid={blob.uuid}
        searchUrl={`${urls.collectionSearch}?exclude_blob_uuid=${blob.uuid}&query=`}
        addObjectUrl={urls.addToCollection}
        addCollectionUrl={urls.createCollection}
        onAddToCollection={refreshCollectionList}
      />

      {/* Left Column */}
      <div className="col-lg-3 d-flex flex-column h-100 mt-2">
        <div className="sticky-top d-flex flex-column flex-grow-last">
          <div className="card backdrop-filter blob-metadata-card">
            <div className="card-body hover-target">
              {/* Actions dropdown */}
              <div className="blob-detail-dropdown">
                <DropDownMenu ref={dropdownMenuRef} dropdownSlot={dropdownItems} />
              </div>

              {/* Edition string */}
              {blob.editionString && <h5>{blob.editionString}</h5>}

              {/* Subtitle */}
              {blob.subtitle && <div id="blob_subtitle">{blob.subtitle}</div>}

              {/* Author */}
              {blob.author && (
                <div className="mt-2">
                  <span className="item-name">by</span>{" "}
                  <span className="item-value">{blob.author}</span>
                </div>
              )}

              {/* Date */}
              {blob.date && <div className="mb-2">{blob.date}</div>}

              {/* Tags */}
              {blob.tags.length > 0 && (
                <div className="d-flex mb-2">
                  <div>
                    <FontAwesomeIcon icon={faTags} className="text-primary" />
                  </div>
                  <div className="ms-2">
                    <div id="blob-tag-list">
                      {blob.tags.map(tag => (
                        <a key={tag.name} className="tag" href={tag.url}>
                          {tag.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* URLs */}
              {blobUrls.length > 0 && (
                <div className="mb-3">
                  {blobUrls.map((urlInfo, index) => (
                    <div key={index}>
                      <FontAwesomeIcon icon={faLink} className="text-primary me-2" />
                      <strong>
                        <a href={urlInfo.url}>{urlInfo.domain}</a>
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata misc and elasticsearch info */}
              {showMetadata && (Object.keys(metadataMisc).length > 0 || elasticsearchInfo) && (
                <div className="highlight-box mb-3">
                  {Object.entries(metadataMisc).map(([name, value]) => (
                    <div key={name} className="d-flex">
                      <div className="item-name me-2">{name}</div>
                      <div className="item-value text-break">{value}</div>
                    </div>
                  ))}

                  {elasticsearchInfo?.contentType && (
                    <div className="d-flex">
                      <div className="item-name me-2">Object Type</div>
                      <div className="item-value">{elasticsearchInfo.contentType}</div>
                    </div>
                  )}

                  {elasticsearchInfo?.size && (
                    <div className="d-flex">
                      <div className="item-name me-2">Size</div>
                      <div className="item-value">{elasticsearchInfo.size}</div>
                    </div>
                  )}

                  {elasticsearchInfo?.numPages && (
                    <div className="d-flex">
                      <div className="item-name me-2">Pages</div>
                      <div className="item-value">{elasticsearchInfo.numPages}</div>
                    </div>
                  )}

                  {elasticsearchInfo?.duration && (
                    <div className="d-flex">
                      <div className="item-name me-2">Duration</div>
                      <div className="item-value">{elasticsearchInfo.duration}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Blob note - user's own markdown content from database */}
              {blob.note && (
                <div
                  className="highlight-box mt-3 text-break"
                  id="blob-note"
                  dangerouslySetInnerHTML={{ __html: getNote() }}
                />
              )}

              {/* Last edited for notes */}
              {blob.isNote && blob.hasBeenModified && blob.modified && (
                <div className="mt-3">
                  <strong className="me-2">Last edited</strong>
                  <small>{blob.modified}</small>
                </div>
              )}

              {/* Nodes */}
              {nodeList.length > 0 && (
                <div className="mt-3">
                  <strong>Nodes:</strong>
                  {nodeList.map(node => (
                    <small key={node.uuid} className="ms-1">
                      <a href={node.url}>{node.name}</a>
                    </small>
                  ))}
                </div>
              )}

              {/* Download button */}
              {blob.sha1sum && blob.fileUrl && (
                <a className="button-icon mt-3" href={blob.fileUrl} role="button">
                  <FontAwesomeIcon icon={faDownload} className="text-emphasis" />
                </a>
              )}
            </div>
          </div>

          {/* Tree menu */}
          {tree.nodes.length > 0 && (
            <div className="card-body backdrop-filter mb-gutter">
              <TreeMenuRoot tree={tree} />
            </div>
          )}

          {/* Collections card */}
          <CollectionsCard collections={collectionList} onAddToCollection={handleAddToCollection} />

          {/* Related Objects */}
          <RelatedObjects
            ref={relatedObjectsRef}
            objectUuid={blob.uuid}
            nodeType="blob"
            showEmptyList={false}
            relatedObjectsUrl={urls.relatedObjects}
            newObjectUrl={urls.addRelatedObject}
            removeObjectUrl={urls.removeRelatedObject}
            sortRelatedObjectsUrl={urls.sortRelatedObjects}
            editRelatedObjectNoteUrl={urls.editRelatedObjectNote}
            searchNamesUrl={urls.searchNames}
            onOpenObjectSelectModal={openObjectSelectModal}
          />

          {/* Back References */}
          {backReferences.length > 0 && <BackReferences backReferences={backReferences} />}
        </div>
      </div>

      {/* Right Column */}
      <div className="col-lg-9 scrollable-panel-scrollbar-hover vh-95 overflow-auto">
        <div className="col-lg-12 d-flex flex-column h-100">
          {/* Video player */}
          {blob.isVideo && blob.fileUrl && (
            <div>
              <video className="h-100 w-100" controls muted>
                <source src={blob.fileUrl} type="video/mp4" />
              </video>
            </div>
          )}

          {/* Cover image for image/pdf blobs */}
          {(blob.isImage || blob.isPdf) && blob.coverUrl && (
            <BlobDetailCover coverUrl={blob.coverUrl} fullSize={!blob.content} />
          )}

          {/* Audio player */}
          {elasticsearchInfo?.contentType === "Audio" && blob.fileUrl && (
            // @ts-ignore - media-chrome web components
            <media-controller audio className="w-100">
              <audio slot="media" src={blob.fileUrl} />
              {/* @ts-ignore */}
              <media-control-bar className="w-100">
                {/* @ts-ignore */}
                <media-play-button />
                {/* @ts-ignore */}
                <media-time-display showDuration />
                {/* @ts-ignore */}
                <media-time-range />
                {/* @ts-ignore */}
                <media-playback-rate-button />
                {/* @ts-ignore */}
                <media-mute-button />
                {/* @ts-ignore */}
                <media-volume-range />
              </media-control-bar>
            </media-controller>
          )}

          {/* Blob content - user's own markdown content from database */}
          {blob.content && (
            <div
              className="blob-content table-borders flex-grow-1 mx-2 mb-3 p-3"
              id="blob-detail-content"
              dangerouslySetInnerHTML={{ __html: getContent() }}
            />
          )}

          {/* SQL Playground link */}
          {elasticsearchInfo?.contentType === "SQLite Database" && urls.sqlPlayground && (
            <a
              href={`${urls.sqlPlayground}?sql_db_uuid=${blob.uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary ms-2"
              role="button"
            >
              SQL Playground
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlobDetailPage;
