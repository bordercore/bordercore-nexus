import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { ContentsSection } from "./sections/ContentsSection";
import { PropertiesSection } from "./sections/PropertiesSection";
import { MetadataSection } from "./sections/MetadataSection";
import { UrlsSection } from "./sections/UrlsSection";
import { NodesSection } from "./sections/NodesSection";
import { CollectionsSection } from "./sections/CollectionsSection";
import { RelatedObjects } from "../../common/relatedObjects/RelatedObjects";
import { BackrefsSection } from "./sections/BackrefsSection";
import type {
  BlobDetail,
  BlobDetailUrls,
  Collection,
  ElasticsearchInfo,
  TreeNode,
  BackReference,
  NodeInfo,
} from "../types";

interface RailProps {
  blob: BlobDetail;
  urls: BlobDetailUrls;
  treeNodes: TreeNode[];
  contentRoot: HTMLElement | null;
  collections: Collection[];
  backRefs: BackReference[];
  elasticsearchInfo: ElasticsearchInfo | null;
  metadataMisc: Record<string, string>;
  blobUrls: Array<{ url: string; domain: string }>;
  nodeList: NodeInfo[];
  onCollectionsChanged: () => void;
  onBackrefsChanged: () => void;
}

export function Rail({
  blob,
  urls,
  treeNodes,
  contentRoot,
  collections,
  backRefs,
  elasticsearchInfo,
  metadataMisc,
  blobUrls,
  nodeList,
  onCollectionsChanged,
  onBackrefsChanged,
}: RailProps) {
  return (
    <aside className="bd-rail-left">
      <ContentsSection nodes={treeNodes} contentRoot={contentRoot} />
      <PropertiesSection blob={blob} elasticsearchInfo={elasticsearchInfo} />
      <MetadataSection metadata={metadataMisc} />
      <UrlsSection urls={blobUrls} />
      <NodesSection nodes={nodeList} />
      <CollectionsSection
        blobUuid={blob.uuid}
        collections={collections}
        collectionSearchUrl={urls.collectionSearch}
        addToCollectionUrl={urls.addToCollection}
        createCollectionUrl={urls.createCollection}
        onChanged={onCollectionsChanged}
      />
      <RelatedObjects
        objectUuid={blob.uuid}
        nodeType="blob"
        urls={{
          relatedObjects: urls.relatedObjects,
          add: urls.addRelatedObject,
          remove: urls.removeRelatedObject,
          sort: urls.sortRelatedObjects,
          editNote: urls.editRelatedObjectNote,
          searchNames: urls.searchNames,
        }}
        className={count => `bd-rail-section${count === 0 ? " is-empty" : ""}`}
        header={({ openAddModal }) => (
          <h3>
            Related
            <span className="bd-section-actions">
              <button
                type="button"
                className="bd-section-act"
                onClick={openAddModal}
                aria-label="Add related object"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </span>
          </h3>
        )}
      />
      <BackrefsSection
        blobUuid={blob.uuid}
        backRefs={backRefs}
        addRelatedObjectUrl={urls.addRelatedObject}
        searchNamesUrl={urls.searchNames}
        createBlobUrl={urls.create}
        onChanged={onBackrefsChanged}
      />
    </aside>
  );
}

export default Rail;
