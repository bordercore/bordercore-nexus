import React from "react";

import type { BlobDetail, ElasticsearchInfo } from "../../types";

interface PropertiesSectionProps {
  blob: BlobDetail;
  elasticsearchInfo: ElasticsearchInfo | null;
}

export function PropertiesSection({ blob, elasticsearchInfo }: PropertiesSectionProps) {
  return (
    <div className="bd-rail-section">
      <h3>Properties</h3>
      <div className="bd-props">
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
