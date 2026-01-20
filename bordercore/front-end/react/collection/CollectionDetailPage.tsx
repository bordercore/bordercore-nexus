import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faImages,
  faPencilAlt,
  faTimes,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { Modal } from "bootstrap";
import axios from "axios";
import MarkdownIt from "markdown-it";
import type {
  CollectionDetail,
  ObjectTag,
  CollectionObject,
  PaginatorInfo,
  CollectionDetailUrls,
  SlideShowConfig,
} from "./types";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import CollectionObjectGrid from "./CollectionObjectGrid";
import ImageViewModal, { ImageViewModalHandle } from "./ImageViewModal";
import EditCollectionModal, { EditCollectionModalHandle } from "./EditCollectionModal";
import DeleteCollectionModal, { DeleteCollectionModalHandle } from "./DeleteCollectionModal";
import SlideShowModal, { SlideShowModalHandle } from "./SlideShowModal";
import SlideShowOverlay from "./SlideShowOverlay";

const markdown = new MarkdownIt();

interface CollectionDetailPageProps {
  collection: CollectionDetail;
  objectTags: ObjectTag[];
  initialTags: string[];
  urls: CollectionDetailUrls;
  csrfToken: string;
  tagSearchUrl: string;
  selectedTag: string | null;
}

export function CollectionDetailPage({
  collection,
  objectTags,
  initialTags,
  urls,
  csrfToken,
  tagSearchUrl,
  selectedTag: initialSelectedTag,
}: CollectionDetailPageProps) {
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [paginator, setPaginator] = useState<PaginatorInfo | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialSelectedTag);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Fetch object list
  const fetchObjectList = useCallback(
    async (pageNumber = 1) => {
      try {
        let url = `${urls.getObjectList}?pageNumber=${pageNumber}`;
        if (selectedTag) {
          url += `&tag=${encodeURIComponent(selectedTag)}`;
        }
        const response = await axios.get(url);
        setObjects(response.data.object_list);
        setPaginator(response.data.paginator);
      } catch (error) {
        console.error("Error fetching object list:", error);
      }
    },
    [urls.getObjectList, selectedTag]
  );

  // Initial fetch
  useEffect(() => {
    fetchObjectList();
  }, [fetchObjectList]);

  // Handle tag selection
  const handleTagSelect = (tag: string | null) => {
    let url = window.location.pathname;
    if (tag) {
      url += `?tag=${encodeURIComponent(tag)}`;
    }
    window.location.href = url;
  };

  // Handle image click
  const handleImageClick = (url: string) => {
    imageViewRef.current?.openModal(url);
  };

  // Handle remove object
  const handleRemoveObject = async (uuid: string) => {
    try {
      const formData = new FormData();
      formData.append("collection_uuid", collection.uuid);
      formData.append("object_uuid", uuid);

      await axios.post(urls.removeObject, formData, {
        headers: {
          "X-CSRFToken": csrfToken,
        },
      });
      fetchObjectList();
    } catch (error) {
      console.error("Error removing object:", error);
    }
  };

  // Handle reorder
  const handleReorder = async (objectUuid: string, newPosition: number) => {
    try {
      const formData = new FormData();
      formData.append("collection_uuid", collection.uuid);
      formData.append("object_uuid", objectUuid);
      formData.append("new_position", String(newPosition));

      await axios.post(urls.sortObjects, formData, {
        headers: {
          "X-CSRFToken": csrfToken,
        },
      });
      fetchObjectList();
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  // Handle file drop
  const handleFileDrop = async (files: FileList) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const processingModal = new Modal("#modalProcessing");
    processingModal.show();

    const file = files[0];
    const formData = new FormData();
    formData.append("blob", file);
    formData.append("collection_uuid", collection.uuid);

    try {
      const response = await axios.post(urls.createBlob, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-CSRFToken": csrfToken,
        },
      });

      setTimeout(() => {
        processingModal.hide();
        setIsProcessing(false);
      }, 500);

      if (response.data.status === "OK") {
        const blobUuid = response.data.blob_uuid;
        const blobUrl = urls.blobDetail.replace(
          /00000000-0000-0000-0000-000000000000/,
          blobUuid
        );
        window.location.href = blobUrl;
      } else {
        alert(response.data.message || "Error creating blob");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      processingModal.hide();
      setIsProcessing(false);
    }
  };

  // Handle pagination
  const handlePaginate = (direction: "prev" | "next") => {
    if (!paginator) return;
    const pageNumber =
      direction === "prev"
        ? paginator.previous_page_number
        : paginator.next_page_number;
    if (pageNumber !== null) {
      fetchObjectList(pageNumber);
    }
  };

  // Slideshow functions
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

  // Keep the ref updated with the latest fetch function to avoid stale closures
  useEffect(() => {
    fetchSlideShowImageRef.current = fetchSlideShowImage;
  }, [fetchSlideShowImage]);

  const handleStartSlideShow = (config: SlideShowConfig) => {
    setSlideShowConfig(config);
    setSlideShowIndex(-1);
    setSlideShowActive(true);

    // Clear any existing interval
    if (slideShowIntervalRef.current) {
      clearInterval(slideShowIntervalRef.current);
    }

    if (config.type === "automatic") {
      // Fetch first image immediately
      const fetchImage = async () => {
        try {
          const params = new URLSearchParams({
            randomize: String(config.randomize),
            position: String(-1),
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
      fetchImage();

      // Set up interval - use ref to avoid stale closure
      const intervalMs = parseInt(config.interval) * 1000 * 60;
      slideShowIntervalRef.current = setInterval(() => {
        fetchSlideShowImageRef.current?.("next");
      }, intervalMs);
    } else {
      // Manual mode - fetch first image
      const fetchFirstImage = async () => {
        try {
          const params = new URLSearchParams({
            randomize: "false",
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
      fetchFirstImage();
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

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (slideShowIntervalRef.current) {
        clearInterval(slideShowIntervalRef.current);
      }
    };
  }, []);

  // Menu items
  const handleEdit = () => editModalRef.current?.openModal();
  const handleDelete = () => deleteModalRef.current?.openModal();
  const handleSlideShowModal = () => slideShowModalRef.current?.openModal();

  const menuLinks = [
    {
      id: "new-blob",
      title: "New Blob",
      url: `/blob/create/?collection_uuid=${collection.uuid}`,
      icon: "plus" as const,
    },
    {
      id: "slide-show",
      title: "Slide Show",
      url: "#",
      icon: "images" as const,
      clickHandler: handleSlideShowModal,
    },
    {
      id: "edit",
      title: "Edit",
      url: "#",
      icon: "pencil-alt" as const,
      clickHandler: handleEdit,
    },
    {
      id: "delete",
      title: "Delete",
      url: "#",
      icon: "times" as const,
      clickHandler: handleDelete,
    },
  ];

  const needsPagination =
    paginator && (paginator.has_previous || paginator.has_next);

  // Render markdown description - content is user-owned and trusted
  const descriptionHtml = collection.description
    ? markdown.render(collection.description)
    : "";

  return (
    <>
      {/* Processing Modal */}
      <div
        className="modal fade"
        id="modalProcessing"
        tabIndex={-1}
        role="dialog"
        data-bs-backdrop="static"
        data-bs-keyboard="false"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-body text-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Processing...</span>
              </div>
              <div className="mt-3">Processing...</div>
            </div>
          </div>
        </div>
      </div>

      {/* Image View Modal */}
      <ImageViewModal ref={imageViewRef} />

      <div className="row g-0 h-100 mx-2">
        {/* Sidebar */}
        <div className="col-lg-3 d-flex flex-column flex-grow-last h-100">
          <div className="card-body h-100">
            {collection.description && (
              <h3
                className="mb-3"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            )}

            <div className="d-flex mb-3">
              <strong>Count</strong>
              <span className="text-primary ms-1">{collection.object_count}</span>
            </div>

            <div className="d-flex mb-3">
              <strong>Edited</strong>
              <span className="text-primary ms-1">{collection.modified}</span>
            </div>

            <hr />

            <h4 className="mt-3">Tag Filter</h4>

            <ul className="list-group flex-column w-100">
              <div
                className={`list-with-counts ps-2 py-1 pe-1 d-flex cursor-pointer ${
                  selectedTag === null ? "selected rounded-sm" : ""
                }`}
                onClick={() => handleTagSelect(null)}
              >
                <div className="ps-2">All Objects</div>
                <div className="ms-auto pe-2">
                  <span className="px-2 badge rounded-pill">
                    {collection.object_count}
                  </span>
                </div>
              </div>
              {objectTags.map((tag) => (
                <li
                  key={tag.id}
                  className={`list-with-counts ps-2 py-1 pe-1 d-flex cursor-pointer ${
                    tag.tag === selectedTag ? "selected rounded-sm" : ""
                  }`}
                  onClick={() => handleTagSelect(tag.tag)}
                >
                  <div className="ps-2">{tag.tag}</div>
                  <div className="ms-auto pe-2">
                    <span className="px-2 badge rounded-pill">{tag.blob_count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-lg-9 d-flex flex-column h-100">
          <Card
            className="h-100"
            titleSlot={
              <div className="d-flex align-items-center">
                <h3 className="me-auto">{collection.name}</h3>
                <DropDownMenu
                  links={menuLinks}
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      <li>
                        <a
                          href={`/blob/create/?collection_uuid=${collection.uuid}`}
                          className="dropdown-menu-item"
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faPlus} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">New Blob</span>
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="dropdown-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSlideShowModal();
                          }}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faImages} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">Slide Show</span>
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="dropdown-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            handleEdit();
                          }}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">Edit</span>
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="dropdown-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                          }}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faTimes} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">Delete</span>
                        </a>
                      </li>
                    </ul>
                  }
                  direction="dropstart"
                />
              </div>
            }
          >
            <hr className="divider" />

            <div className="d-flex ms-2">
              <div>
                <ul className="text-center list-unstyled collection-sortable">
                  <CollectionObjectGrid
                    objects={objects}
                    onImageClick={handleImageClick}
                    onRemoveObject={handleRemoveObject}
                    onReorder={handleReorder}
                    onFileDrop={handleFileDrop}
                  />
                </ul>
              </div>

              {objects.length === 0 && (
                <h5 className="text-secondary">This collection is empty.</h5>
              )}

              {needsPagination && (
                <h5 className="d-flex mb-0 me-1 pt-3">
                  <div>
                    {paginator?.has_previous ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePaginate("prev");
                        }}
                        className="me-1 glow icon-hover"
                      >
                        <FontAwesomeIcon
                          icon={faChevronLeft}
                          className="text-emphasis"
                        />
                      </a>
                    ) : (
                      <FontAwesomeIcon
                        icon={faChevronLeft}
                        className="text-emphasis icon-disabled"
                      />
                    )}
                  </div>
                  <div>
                    {paginator?.has_next ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePaginate("next");
                        }}
                        className="ms-1 glow icon-hover"
                      >
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className="text-emphasis"
                        />
                      </a>
                    ) : (
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        className="text-emphasis icon-disabled"
                      />
                    )}
                  </div>
                </h5>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <EditCollectionModal
        ref={editModalRef}
        collection={collection}
        initialTags={initialTags}
        updateUrl={urls.updateCollection}
        tagSearchUrl={tagSearchUrl}
        csrfToken={csrfToken}
      />

      {/* Delete Modal */}
      <DeleteCollectionModal
        ref={deleteModalRef}
        deleteUrl={urls.deleteCollection}
        csrfToken={csrfToken}
      />

      {/* Slideshow Modal */}
      <SlideShowModal
        ref={slideShowModalRef}
        objectTags={objectTags}
        onStart={handleStartSlideShow}
      />

      {/* Slideshow Overlay */}
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

export default CollectionDetailPage;
