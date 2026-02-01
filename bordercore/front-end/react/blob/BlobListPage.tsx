import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faFileImport, faBookOpen } from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";
import { DropDownMenu } from "../common/DropDownMenu";
import type { BlobListPageProps, NavItem, Blob } from "./types";

const markdown = new MarkdownIt();

const NAV_ALL: NavItem[] = ["All", "Notes", "Images", "Documents", "Blobs"];

function getDeltaDays(delta: number): string {
  if (delta === 0) {
    return "Today";
  }
  return `${delta} ${delta === 1 ? "day" : "days"} ago`;
}

function getNormalizedDoctype(doctype: NavItem): string {
  const dt = doctype.toLowerCase();
  if (dt === "all") {
    return "all";
  }
  // Remove trailing 's' (Notes -> note, Images -> image, etc.)
  return dt.substring(0, dt.length - 1);
}

export function BlobListPage({ blobListData, urls }: BlobListPageProps) {
  const [navCurrent, setNavCurrent] = useState<NavItem>("All");

  const visibleNav = useMemo(() => {
    return NAV_ALL.filter(nav => {
      if (nav === "All") return true;
      const doctype = getNormalizedDoctype(nav);
      return (blobListData.docTypes[doctype as keyof typeof blobListData.docTypes] || 0) > 0;
    });
  }, [blobListData.docTypes]);

  const filteredBlobs = useMemo(() => {
    if (navCurrent === "All") {
      return blobListData.blobList;
    }
    const doctype = getNormalizedDoctype(navCurrent);
    return blobListData.blobList.filter(blob => blob.doctype === doctype);
  }, [blobListData.blobList, navCurrent]);

  const doctypeCount = (nav: NavItem): number => {
    const doctype = getNormalizedDoctype(nav);
    return blobListData.docTypes[doctype as keyof typeof blobListData.docTypes] || 0;
  };

  const getContent = (blob: Blob): string => {
    // User-owned content rendered with markdown-it
    return markdown.render(blob.content || "");
  };

  const handleClickBlob = (url: string) => {
    window.location.href = url;
  };

  const handleClickNav = (nav: NavItem) => {
    setNavCurrent(nav);
  };

  // Scale down headings in blob content after render
  useEffect(() => {
    document.querySelectorAll(".blob-content :is(h1, h2, h3, h4, h5, h6)").forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl, null).getPropertyValue("font-size");
      const fontSize = parseFloat(style);
      // The 0.35 factor is based on scaling <h6> tags to 4px
      htmlEl.style.fontSize = 0.35 * fontSize + "px";
    });
  }, [filteredBlobs]);

  return (
    <>
      <div className="row card-grid">
        <div className="col-lg-12 d-flex">
          <h1>Recent Blobs</h1>

          <div className="me-2 ms-auto">
            <DropDownMenu
              dropdownSlot={
                <ul className="dropdown-menu-list">
                  <li>
                    <a className="dropdown-item" href={urls.createBlob}>
                      <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
                      <span>New Blob</span>
                    </a>
                  </li>
                  <li>
                    <a className="dropdown-item" href={urls.importBlob}>
                      <FontAwesomeIcon icon={faFileImport} className="text-primary me-3" />
                      <span>Import Blob</span>
                    </a>
                  </li>
                  <li>
                    <a className="dropdown-item" href={urls.bookshelf}>
                      <FontAwesomeIcon icon={faBookOpen} className="text-primary me-3" />
                      <span>Bookshelf</span>
                    </a>
                  </li>
                </ul>
              }
            />
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mx-3">
        {visibleNav.map(nav => (
          <li key={nav} className="nav-item px-5" onClick={() => handleClickNav(nav)}>
            <a
              className={`nav-link ${navCurrent === nav ? "active" : ""}`}
              data-bs-toggle="tab"
              href="#"
              onClick={e => e.preventDefault()}
            >
              {nav}
              <span className="badge rounded-pill align-middle ms-2">{doctypeCount(nav)}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="d-flex flex-row flex-wrap ms-3">
        {filteredBlobs.map((blob, index) => (
          <div
            key={`${blob.url}-${index}`}
            className="blob-list float-start mb-2 p-3 w-25"
            onClick={() => handleClickBlob(blob.url)}
            data-doctype={blob.doctype}
          >
            <div className="d-flex flex-column h-100">
              <h5 className="text-center mb-2">
                <a href={blob.url} className="text-primary" onClick={e => e.stopPropagation()}>
                  {blob.name}
                </a>
              </h5>

              {blob.cover_url && (
                <a href={blob.url} onClick={e => e.stopPropagation()}>
                  <img className="w-100" src={blob.cover_url} alt={blob.name} />
                </a>
              )}

              {(blob.doctype === "note" || blob.doctype === "document") && (
                <div
                  className="blob-content"
                  // User-owned content - safe to render
                  dangerouslySetInnerHTML={{ __html: getContent(blob) }}
                />
              )}

              <div className="blob-info d-flex justify-content-between mt-auto">
                <div className="text-primary me-auto">{getDeltaDays(blob.delta_days)}</div>
                <div className="text-center">
                  {blob.content_size !== "0 Bytes" && (
                    <span>
                      Size: <span className="text-primary">{blob.content_size}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default BlobListPage;
