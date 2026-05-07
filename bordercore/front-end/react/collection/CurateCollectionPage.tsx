import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { arrayMove } from "@dnd-kit/sortable";
import axios from "axios";
import type {
  CollectionDetail,
  CollectionDetailUrls,
  CollectionObject,
  ObjectTag,
  PaginatorInfo,
  SlideShowConfig,
} from "./types";
import CurateRail from "./CurateRail";
import CurateHeader from "./CurateHeader";
import CurateGrid from "./CurateGrid";
import ImageViewModal, { ImageViewModalHandle } from "./ImageViewModal";
import EditCollectionModal, { EditCollectionModalHandle } from "./EditCollectionModal";
import DeleteCollectionModal, { DeleteCollectionModalHandle } from "./DeleteCollectionModal";
import SlideShowModal, { SlideShowModalHandle } from "./SlideShowModal";
import SlideShowOverlay from "./SlideShowOverlay";

const RAIL_KEY = "bordercore.collection.rail-open";
const densityKey = (uuid: string) => `bordercore.collection.${uuid}.density`;

function readDensity(uuid: string): 3 | 4 | 5 | 6 {
  try {
    const raw = window.localStorage.getItem(densityKey(uuid));
    const n = raw ? Number(raw) : 4;
    if (n >= 3 && n <= 6) return n as 3 | 4 | 5 | 6;
  } catch {
    // localStorage unavailable; fall through to default
  }
  return 4;
}

function readRailOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(RAIL_KEY);
    return raw === null ? true : raw !== "false";
  } catch {
    return true;
  }
}

function fisherYates<T>(input: T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function navigateToTag(tag: string | null) {
  const url = new URL(window.location.href);
  if (tag) {
    url.searchParams.set("tag", tag);
  } else {
    url.searchParams.delete("tag");
  }
  window.location.href = url.toString();
}

interface CurateCollectionPageProps {
  collection: CollectionDetail;
  objectTags: ObjectTag[];
  initialTags: string[];
  urls: CollectionDetailUrls;
  tagSearchUrl: string;
  selectedTag: string | null;
}

export function CurateCollectionPage({
  collection,
  objectTags,
  initialTags,
  urls,
  tagSearchUrl,
  selectedTag: activeTag,
}: CurateCollectionPageProps) {
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [paginator, setPaginator] = useState<PaginatorInfo | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [columns, setColumns] = useState<3 | 4 | 5 | 6>(() => readDensity(collection.uuid));
  const [railOpen, setRailOpen] = useState<boolean>(() => readRailOpen());
  const [shuffled, setShuffled] = useState(false);
  const [processingOpen, setProcessingOpen] = useState(false);

  // Slideshow state
  const [slideShowActive, setSlideShowActive] = useState(false);
  const [slideShowImageUrl, setSlideShowImageUrl] = useState("");
  const [slideShowContentType, setSlideShowContentType] = useState<"Image" | "Video">("Image");
  const [slideShowIndex, setSlideShowIndex] = useState(-1);
  const [slideShowConfig, setSlideShowConfig] = useState<SlideShowConfig | null>(null);
  const slideShowIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSlideShowImageRef = useRef<(direction: "next" | "previous") => Promise<void>>();

  // Modal refs
  const imageViewRef = useRef<ImageViewModalHandle>(null);
  const editModalRef = useRef<EditCollectionModalHandle>(null);
  const deleteModalRef = useRef<DeleteCollectionModalHandle>(null);
  const slideShowModalRef = useRef<SlideShowModalHandle>(null);

  const fetchPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      let url = `${urls.getObjectList}?pageNumber=${pageNumber}`;
      if (activeTag) url += `&tag=${encodeURIComponent(activeTag)}`;
      const response = await axios.get(url);
      setPaginator(response.data.paginator);
      if (append) {
        setObjects(prev => [...prev, ...response.data.object_list]);
      } else {
        setObjects(response.data.object_list);
      }
    },
    [urls.getObjectList, activeTag]
  );

  // Initial load
  useEffect(() => {
    setLoadingInitial(true);
    fetchPage(1, false)
      .catch(err => console.error("Error fetching collection objects:", err))
      .finally(() => setLoadingInitial(false));
  }, [fetchPage]);

  // Persist density
  useEffect(() => {
    try {
      window.localStorage.setItem(densityKey(collection.uuid), String(columns));
    } catch {
      // Ignore quota / disabled storage
    }
  }, [collection.uuid, columns]);

  // Persist rail-open
  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_KEY, String(railOpen));
    } catch {
      // Ignore quota / disabled storage
    }
  }, [railOpen]);

  const handleLoadMore = useCallback(() => {
    if (!paginator?.has_next || loadingMore || shuffled) return;
    const next = paginator.next_page_number;
    if (!next) return;
    setLoadingMore(true);
    fetchPage(next, true)
      .catch(err => console.error("Error loading next page:", err))
      .finally(() => setLoadingMore(false));
  }, [paginator, loadingMore, shuffled, fetchPage]);

  const handleReorder = useCallback(
    async (oldIndex: number, newIndex: number) => {
      const item = objects[oldIndex];
      if (!item) return;
      const previous = objects;
      const reordered = arrayMove(objects, oldIndex, newIndex);
      setObjects(reordered);
      try {
        const formData = new FormData();
        formData.append("collection_uuid", collection.uuid);
        formData.append("object_uuid", item.uuid);
        formData.append("new_position", String(newIndex + 1));
        await axios.post(urls.sortObjects, formData);
      } catch (err) {
        console.error("Error reordering:", err);
        setObjects(previous);
      }
    },
    [objects, collection.uuid, urls.sortObjects]
  );

  const handleRemove = useCallback(
    async (object: CollectionObject) => {
      if (!window.confirm(`Remove "${object.name || "this item"}" from the collection?`)) return;
      try {
        const formData = new FormData();
        formData.append("collection_uuid", collection.uuid);
        formData.append("object_uuid", object.uuid);
        await axios.post(urls.removeObject, formData);
        setObjects(prev => prev.filter(o => o.uuid !== object.uuid));
        setPaginator(prev => (prev ? { ...prev, count: Math.max(prev.count - 1, 0) } : prev));
      } catch (err) {
        console.error("Error removing object:", err);
      }
    },
    [collection.uuid, urls.removeObject]
  );

  const handleThumbClick = useCallback((object: CollectionObject) => {
    if (object.type === "blob") {
      imageViewRef.current?.openModal(object.cover_url_large);
    } else {
      window.open(object.url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    navigateToTag(tag);
  }, []);

  const handleSelectTag = useCallback((tag: string | null) => {
    navigateToTag(tag);
  }, []);

  const handleClearFilter = useCallback(() => {
    navigateToTag(null);
  }, []);

  const handleShuffle = useCallback(() => {
    setShuffled(prev => {
      if (prev) return false;
      setObjects(curr => fisherYates(curr));
      return true;
    });
  }, []);

  const handleColumnsChange = useCallback((n: 3 | 4 | 5 | 6) => {
    setColumns(n);
  }, []);

  const handleToggleRail = useCallback(() => {
    setRailOpen(open => !open);
  }, []);

  const handleEdit = useCallback(() => editModalRef.current?.openModal(), []);
  const handleDelete = useCallback(() => deleteModalRef.current?.openModal(), []);
  const handleSlideshow = useCallback(() => slideShowModalRef.current?.openModal(), []);

  const handleAdd = useCallback(() => {
    window.location.href = `/blob/create/?collection_uuid=${collection.uuid}`;
  }, [collection.uuid]);

  const handleFileDrop = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;
      setProcessingOpen(true);

      const file = files[0];
      const formData = new FormData();
      formData.append("blob", file);
      formData.append("collection_uuid", collection.uuid);

      try {
        const response = await axios.post(urls.createBlob, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const blobUuid = response.data.blob_uuid;
        const blobUrl = urls.blobDetail.replace(/00000000-0000-0000-0000-000000000000/, blobUuid);
        window.location.href = blobUrl;
      } catch (error: unknown) {
        const axErr = error as {
          response?: { data?: { detail?: string; existing_blob_url?: string } };
        };
        const data = axErr.response?.data;
        if (data?.existing_blob_url) {
          if (window.confirm(`${data.detail} View existing blob?`)) {
            window.location.href = data.existing_blob_url;
            return;
          }
        } else {
          window.alert(data?.detail || "Error uploading file");
        }
        setProcessingOpen(false);
      }
    },
    [collection.uuid, urls.createBlob, urls.blobDetail]
  );

  // Slideshow plumbing — kept identical to the legacy CollectionDetailPage
  const fetchSlideShowImage = useCallback(
    async (direction: "next" | "previous" = "next") => {
      if (!slideShowConfig) return;
      try {
        const params = new URLSearchParams({
          randomize: String(slideShowConfig.randomize),
          position: String(slideShowIndex),
          tag: slideShowConfig.tag,
          direction,
        });
        const response = await axios.get(`${urls.getBlob}?${params}`);
        setSlideShowIndex(response.data.index);
        setSlideShowImageUrl(response.data.url);
        setSlideShowContentType(response.data.content_type === "Image" ? "Image" : "Video");
      } catch (error) {
        console.error("Error fetching slideshow image:", error);
      }
    },
    [urls.getBlob, slideShowIndex, slideShowConfig]
  );

  useEffect(() => {
    fetchSlideShowImageRef.current = fetchSlideShowImage;
  }, [fetchSlideShowImage]);

  const handleStartSlideShow = (config: SlideShowConfig) => {
    setSlideShowConfig(config);
    setSlideShowIndex(-1);
    setSlideShowActive(true);

    if (slideShowIntervalRef.current) {
      clearInterval(slideShowIntervalRef.current);
    }

    const fetchFirst = async (randomize: boolean) => {
      try {
        const params = new URLSearchParams({
          randomize: String(randomize),
          position: "-1",
          tag: config.tag,
          direction: "next",
        });
        const response = await axios.get(`${urls.getBlob}?${params}`);
        setSlideShowIndex(response.data.index);
        setSlideShowImageUrl(response.data.url);
        setSlideShowContentType(response.data.content_type === "Image" ? "Image" : "Video");
      } catch (error) {
        console.error("Error fetching slideshow image:", error);
      }
    };

    if (config.type === "automatic") {
      fetchFirst(config.randomize);
      const intervalMs = parseInt(config.interval) * 1000 * 60;
      slideShowIntervalRef.current = setInterval(() => {
        fetchSlideShowImageRef.current?.("next");
      }, intervalMs);
    } else {
      fetchFirst(false);
    }
  };

  const handleSlideShowClose = useCallback(() => {
    setSlideShowActive(false);
    setSlideShowImageUrl("");
    setSlideShowConfig(null);
    if (slideShowIntervalRef.current) {
      clearInterval(slideShowIntervalRef.current);
      slideShowIntervalRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (slideShowIntervalRef.current) clearInterval(slideShowIntervalRef.current);
    },
    []
  );

  const filteredCount = paginator ? paginator.count : objects.length;
  const hasMore = !!paginator?.has_next;

  return (
    <>
      {processingOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" />
            <div
              className="refined-modal cd-curate-processing"
              role="dialog"
              aria-label="processing"
              aria-live="polite"
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Processing...</span>
              </div>
              <div className="cd-curate-processing-label">Processing…</div>
            </div>
          </>,
          document.body
        )}

      <ImageViewModal ref={imageViewRef} />

      <div className="cd-curate">
        <CurateHeader
          collection={collection}
          filteredCount={filteredCount}
          columns={columns}
          shuffled={shuffled}
          onColumnsChange={handleColumnsChange}
          onShuffle={handleShuffle}
          onEdit={handleEdit}
          onAdd={handleAdd}
          onSlideshow={handleSlideshow}
          onDelete={handleDelete}
        />
        <div className={railOpen ? "cd-shell" : "cd-shell collapsed"}>
          <CurateRail
            objectTags={objectTags}
            totalCount={collection.object_count}
            activeTag={activeTag}
            collapsed={!railOpen}
            onToggleCollapsed={handleToggleRail}
            onSelectTag={handleSelectTag}
          />

          <main className="cd-main">
            <CurateGrid
              objects={objects}
              columns={columns}
              shuffled={shuffled}
              hasMore={hasMore}
              loadingInitial={loadingInitial}
              loadingMore={loadingMore}
              activeTag={activeTag}
              onReorder={handleReorder}
              onLoadMore={handleLoadMore}
              onThumbClick={handleThumbClick}
              onRemove={handleRemove}
              onTagClick={handleTagClick}
              onFileDrop={handleFileDrop}
              onClearFilter={handleClearFilter}
              onAdd={handleAdd}
            />
          </main>
        </div>
      </div>

      <EditCollectionModal
        ref={editModalRef}
        collection={collection}
        initialTags={initialTags}
        updateUrl={urls.updateCollection}
        tagSearchUrl={tagSearchUrl}
      />

      <DeleteCollectionModal
        ref={deleteModalRef}
        deleteUrl={urls.deleteCollection}
        collectionName={collection.name}
      />

      <SlideShowModal
        ref={slideShowModalRef}
        objectTags={objectTags}
        onStart={handleStartSlideShow}
      />

      <SlideShowOverlay
        isActive={slideShowActive}
        imageUrl={slideShowImageUrl}
        contentType={slideShowContentType}
        onNext={() => fetchSlideShowImageRef.current?.("next")}
        onPrevious={() => fetchSlideShowImageRef.current?.("previous")}
        onClose={handleSlideShowClose}
      />
    </>
  );
}

export default CurateCollectionPage;
