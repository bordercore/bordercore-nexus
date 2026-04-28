import React from "react";

import { ContentsSection } from "./sections/ContentsSection";
import { PropertiesSection } from "./sections/PropertiesSection";
import { MetadataSection } from "./sections/MetadataSection";
import { UrlsSection } from "./sections/UrlsSection";
import { NodesSection } from "./sections/NodesSection";
import { CollectionsSection } from "./sections/CollectionsSection";
import { RelatedObjectsSection } from "./sections/RelatedObjectsSection";
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
      <RelatedObjectsSection
        blobUuid={blob.uuid}
        relatedObjectsUrl={urls.relatedObjects}
        addRelatedObjectUrl={urls.addRelatedObject}
        removeRelatedObjectUrl={urls.removeRelatedObject}
        searchNamesUrl={urls.searchNames}
        createBlobUrl={urls.create}
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
