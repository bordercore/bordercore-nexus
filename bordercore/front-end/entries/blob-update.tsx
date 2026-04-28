import React from "react";
import { createRoot } from "react-dom/client";
import BlobUpdatePage from "../react/blob/BlobUpdatePage";

interface MetadataItem {
  name: string;
  value: string;
}

interface Template {
  uuid: string;
  name: string;
}

interface LinkedBlob {
  uuid: string;
  name: string;
  thumbnail_url?: string;
}

interface CollectionInfo {
  uuid: string;
  name: string;
}

interface LinkedCollection {
  uuid: string;
  blobs: Array<{ uuid: string; name: string }>;
}

interface CollectionItem {
  uuid: string;
  name: string;
  num_objects: number;
  url?: string;
}

interface BackrefItem {
  uuid: string;
  type: "blob" | "question";
  name?: string;
  question?: string;
  url?: string;
}

const container = document.getElementById("react-root");

if (container) {
  const parseJsonScript = <T,>(id: string, defaultValue: T): T => {
    const script = document.getElementById(id);
    if (script) {
      try {
        return JSON.parse(script.textContent || "null") ?? defaultValue;
      } catch (e) {
        console.error(`Error parsing ${id}:`, e);
      }
    }
    return defaultValue;
  };

  const metadata: MetadataItem[] = parseJsonScript("metadata", []);
  const tags: string[] = parseJsonScript("initial-tags", []);
  const templateList: Template[] = parseJsonScript("templateList", []);
  const linkedBlob: LinkedBlob | undefined = parseJsonScript("linked-blob", undefined);
  const linkedCollection: LinkedCollection | undefined = parseJsonScript(
    "linked-collection",
    undefined
  );
  const collectionInfo: CollectionInfo | undefined = parseJsonScript("collection-info", undefined);
  const collections: CollectionItem[] = parseJsonScript("collections", []);
  const backrefs: BackrefItem[] = parseJsonScript("backrefs", []);
  const formData = parseJsonScript("form-data", {
    name: "",
    date: new Date().toISOString().split("T")[0],
    content: "",
    note: "",
    filename: "",
    importance: false as boolean | number,
    is_note: false,
    math_support: false,
  });

  const dateFormat = (container.dataset.dateFormat || "standard") as "standard" | "year";
  const blobUuid = container.dataset.blobUuid || undefined;
  const blobSha1sum = container.dataset.blobSha1sum || undefined;
  const isPdf = container.dataset.isPdf === "true";
  const pdfPageNumber = parseInt(container.dataset.pdfPageNumber || "1", 10);
  const pdfNumPages = container.dataset.pdfNumPages
    ? parseInt(container.dataset.pdfNumPages, 10)
    : undefined;
  const coverUrl = container.dataset.coverUrl || undefined;
  const doctype = (container.dataset.doctype as
    | "video"
    | "book"
    | "image"
    | "note"
    | "audio"
    | "blob"
    | undefined) || undefined;
  const fileSize = container.dataset.fileSize || undefined;
  const durationLabel = container.dataset.duration || undefined;
  const isBook = container.dataset.isBook === "true";
  const csrfToken = container.dataset.csrfToken || "";

  const urls = {
    submit: container.dataset.submitUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
    metadataNameSearch: container.dataset.metadataNameSearchUrl || "",
    getTemplate: container.dataset.getTemplateUrl || "",
    updateCoverImage: container.dataset.updateCoverImageUrl || "",
    updatePageNumber: container.dataset.updatePageNumberUrl || "",
    parseDate: container.dataset.parseDateUrl || "",
    blobDetail: container.dataset.blobDetailUrl || "",
    list: container.dataset.listUrl || "",
    detail: container.dataset.detailUrl || "",
    clone: container.dataset.cloneUrl || undefined,
    delete: container.dataset.deleteUrl || undefined,
    download: container.dataset.downloadUrl || undefined,
  };

  let initialDate = formData.date || new Date().toISOString().split("T")[0];
  if (initialDate.includes("T")) {
    initialDate = initialDate.split("T")[0];
  }

  const root = createRoot(container);
  root.render(
    <BlobUpdatePage
      initialName={formData.name || ""}
      initialDate={initialDate}
      initialDateFormat={dateFormat}
      initialContent={formData.content || ""}
      initialTags={tags}
      initialNote={formData.note || ""}
      initialImportance={formData.importance === true || formData.importance === 10}
      initialIsNote={formData.is_note === true}
      initialIsBook={isBook}
      initialMathSupport={formData.math_support === true}
      initialFileName={formData.filename || ""}
      initialMetadata={metadata}
      templateList={templateList}
      blobUuid={blobUuid}
      blobSha1sum={blobSha1sum}
      doctype={doctype}
      isPdf={isPdf}
      pdfPageNumber={pdfPageNumber}
      pdfNumPages={pdfNumPages}
      coverUrl={coverUrl}
      fileSize={fileSize}
      durationLabel={durationLabel}
      collections={collections}
      backrefs={backrefs}
      linkedBlob={linkedBlob}
      linkedCollection={linkedCollection}
      collectionInfo={collectionInfo}
      urls={urls}
      csrfToken={csrfToken}
    />
  );
}
