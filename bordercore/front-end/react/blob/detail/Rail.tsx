import React from "react";

import { ContentsSection } from "./sections/ContentsSection";
import { RelatedObjectsSection } from "./sections/RelatedObjectsSection";
import { CollectionsSection } from "./sections/CollectionsSection";
import { BackrefsSection } from "./sections/BackrefsSection";
import type { BlobDetail, BlobDetailUrls, Collection, TreeNode, BackReference } from "../types";

interface RailProps {
  blob: BlobDetail;
  urls: BlobDetailUrls;
  treeNodes: TreeNode[];
  contentRoot: HTMLElement | null;
  collections: Collection[];
  backRefs: BackReference[];
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
  onCollectionsChanged,
  onBackrefsChanged,
}: RailProps) {
  return (
    <aside className="bd-rail-left">
      <ContentsSection nodes={treeNodes} contentRoot={contentRoot} />
      <RelatedObjectsSection
        blobUuid={blob.uuid}
        relatedObjectsUrl={urls.relatedObjects}
        addRelatedObjectUrl={urls.addRelatedObject}
        removeRelatedObjectUrl={urls.removeRelatedObject}
        searchNamesUrl={urls.searchNames}
        createBlobUrl={urls.create}
      />
      <CollectionsSection
        blobUuid={blob.uuid}
        collections={collections}
        collectionSearchUrl={urls.collectionSearch}
        addToCollectionUrl={urls.addToCollection}
        createCollectionUrl={urls.createCollection}
        onChanged={onCollectionsChanged}
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
