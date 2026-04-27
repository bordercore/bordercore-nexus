import React, { useCallback } from "react";

import { EventBus } from "../../../utils/reactUtils";
import type { BlobDetail, ElasticsearchInfo } from "../../types";

interface PropertiesSectionProps {
  blob: BlobDetail;
  elasticsearchInfo: ElasticsearchInfo | null;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  EventBus.$emit("toast", {
    body: `${label} copied to clipboard`,
  });
}

export function PropertiesSection({ blob, elasticsearchInfo }: PropertiesSectionProps) {
  const handleCopyUuid = useCallback(() => copyToClipboard(blob.uuid, "UUID"), [blob.uuid]);
  const handleCopySha1 = useCallback(() => {
    if (blob.sha1sum) copyToClipboard(blob.sha1sum, "SHA1");
  }, [blob.sha1sum]);

  return (
    <div className="bd-rail-section">
      <h3>Properties</h3>
      <div className="bd-props">
        {blob.doctype && (
          <div className="bd-prop">
            <span className="k">doctype</span>
            <span className="v">{blob.doctype}</span>
          </div>
        )}
        <div className="bd-prop">
          <span className="k">name</span>
          <span className="v">{blob.name || "—"}</span>
        </div>
        <div className="bd-prop">
          <span className="k">uuid</span>
          <span className="v copy" onClick={handleCopyUuid} title="Click to copy">
            {blob.uuid.slice(0, 8)}…
          </span>
        </div>
        {blob.sha1sum && (
          <div className="bd-prop">
            <span className="k">sha1</span>
            <span className="v copy" onClick={handleCopySha1} title="Click to copy">
              {blob.sha1sum.slice(0, 10)}…
            </span>
          </div>
        )}
        {blob.created && (
          <div className="bd-prop">
            <span className="k">created</span>
            <span className="v dim">{blob.created}</span>
          </div>
        )}
        {blob.modified && (
          <div className="bd-prop">
            <span className="k">modified</span>
            <span className="v dim">{blob.modified}</span>
          </div>
        )}
        <div className="bd-prop">
          <span className="k">indexed</span>
          <span className={`v ${blob.isIndexed ? "ok" : "dim"}`}>
            {blob.isIndexed ? "✓ true" : "✗ false"}
          </span>
        </div>
        {blob.mathSupport && (
          <div className="bd-prop">
            <span className="k">math</span>
            <span className="v ok">enabled</span>
          </div>
        )}
        {elasticsearchInfo?.contentType && (
          <div className="bd-prop">
            <span className="k">type</span>
            <span className="v dim">{elasticsearchInfo.contentType}</span>
          </div>
        )}
        {elasticsearchInfo?.size && (
          <div className="bd-prop">
            <span className="k">size</span>
            <span className="v dim">{elasticsearchInfo.size}</span>
          </div>
        )}
        {elasticsearchInfo?.numPages && (
          <div className="bd-prop">
            <span className="k">pages</span>
            <span className="v dim">{elasticsearchInfo.numPages}</span>
          </div>
        )}
        {elasticsearchInfo?.duration && (
          <div className="bd-prop">
            <span className="k">duration</span>
            <span className="v dim">{elasticsearchInfo.duration}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertiesSection;
