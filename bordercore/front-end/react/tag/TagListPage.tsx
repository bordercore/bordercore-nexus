import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus, faInfo } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { SelectValue, type SelectValueHandle } from "../common/SelectValue";
import { TagAliasTable } from "./TagAliasTable";
import { AddTagAliasModal, type AddTagAliasModalHandle } from "./AddTagAliasModal";
import { doGet, doDelete, EventBus } from "../utils/reactUtils";
import type { TagInfo, TagAlias, TagListUrls } from "./types";

interface TagListPageProps {
  initialTagInfo: TagInfo;
  urls: TagListUrls;
}

export function TagListPage({ initialTagInfo, urls }: TagListPageProps) {
  const [tagInfo, setTagInfo] = useState<TagInfo>(initialTagInfo);
  const [aliases, setAliases] = useState<TagAlias[]>([]);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const selectValueRef = useRef<SelectValueHandle>(null);
  const addAliasModalRef = useRef<AddTagAliasModalHandle>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const getTagAliasList = () => {
    doGet(
      urls.tagAliasListUrl,
      response => {
        setAliases(response.data.results);
      },
      "Error retrieving tag alias list"
    );
  };

  const getTodoCounts = (tagName?: string) => {
    let url = urls.getTodoCountsUrl;
    if (tagName) {
      url = `${url}?tag_name=${encodeURIComponent(tagName)}`;
    }
    doGet(
      url,
      response => {
        setTagInfo(response.data.info);
        setDataLoading(false);
      },
      "Error retrieving tag counts"
    );
  };

  const openSearchWindow = () => {
    setShowTagSearch(true);
    setTimeout(() => {
      selectValueRef.current?.focus();
    }, 500);
  };

  const handleTagSelect = (selection: { label?: string; name?: string }) => {
    const tagName = selection.label || selection.name;
    if (tagName) {
      getTodoCounts(tagName);
    }
    setShowTagSearch(false);
  };

  const handleDeleteAlias = (uuid: string) => {
    const deleteUrl = urls.tagAliasDetailUrl.replace("00000000-0000-0000-0000-000000000000", uuid);
    doDelete(
      deleteUrl,
      () => {
        EventBus.$emit("toast", {
          body: "Tag alias deleted",
        });
        getTagAliasList();
      },
      ""
    );
  };

  const handleOpenModal = () => {
    addAliasModalRef.current?.openModal();
  };

  const handleAliasAdded = () => {
    getTagAliasList();
  };

  useEffect(() => {
    getTagAliasList();
    getTodoCounts();
  }, []);

  // Handle click outside to close search
  useEffect(() => {
    if (!showTagSearch) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowTagSearch(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTagSearch]);

  return (
    <div className="row g-0 h-100 mx-2">
      {/* Tag Info Sidebar */}
      <div className="col-lg-3 d-flex flex-column flex-grow-last pe-gutter">
        <div className="card">
          <div className="card-body backdrop-filter">
            <div className="d-flex position-relative">
              <h4>Tag Info</h4>
              {showTagSearch && (
                <div id="tags-search" ref={searchContainerRef}>
                  <SelectValue
                    ref={selectValueRef}
                    searchUrl={`${urls.tagSearchUrl}?query=`}
                    placeHolder="Tag name"
                    onSelect={handleTagSelect}
                  />
                </div>
              )}
              <div
                className="ms-auto d-flex align-items-center cursor-pointer"
                onClick={openSearchWindow}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="glow text-emphasis" />
              </div>
            </div>
            <h4>
              <strong className="text-primary">{tagInfo.name}</strong>
            </h4>

            <div className={`d-flex flex-column ${dataLoading ? "d-none" : ""}`}>
              <div className="list-header-border mb-2 pb-2 mt-4">Objects using this tag</div>

              {tagInfo.blob__count > 0 && (
                <div>
                  <span className="text-name">Blobs</span>:{" "}
                  <span className="text-value">{tagInfo.blob__count}</span>
                </div>
              )}
              {tagInfo.bookmark__count > 0 && (
                <div>
                  <span className="text-name">Bookmarks</span>:{" "}
                  <span className="text-value">{tagInfo.bookmark__count}</span>
                </div>
              )}
              {tagInfo.todo__count > 0 && (
                <div>
                  <span className="text-name">Todos</span>:{" "}
                  <span className="text-value">{tagInfo.todo__count}</span>
                </div>
              )}
              {tagInfo.question__count > 0 && (
                <div>
                  <span className="text-name">Questions</span>:{" "}
                  <span className="text-value">{tagInfo.question__count}</span>
                </div>
              )}
              {tagInfo.song__count > 0 && (
                <div>
                  <span className="text-name">Songs</span>:{" "}
                  <span className="text-value">{tagInfo.song__count}</span>
                </div>
              )}
              {tagInfo.album__count > 0 && (
                <div>
                  <span className="text-name">Albums</span>:{" "}
                  <span className="text-value">{tagInfo.album__count}</span>
                </div>
              )}
              {tagInfo.collection__count > 0 && (
                <div>
                  <span className="text-name">Collections</span>:{" "}
                  <span className="text-value">{tagInfo.collection__count}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tag Aliases Table */}
      <div className="col-lg-9">
        <Card
          className="backdrop-filter"
          titleSlot={
            <div className="d-flex">
              <h4>Tag Aliases</h4>
              <div className="ms-auto me-2">
                <DropDownMenu
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      <li>
                        <a
                          href="#"
                          className="dropdown-menu-item"
                          onClick={e => {
                            e.preventDefault();
                            handleOpenModal();
                          }}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faPlus} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">New Tag</span>
                        </a>
                      </li>
                    </ul>
                  }
                />
              </div>
            </div>
          }
        >
          <div className="d-flex">
            <div className="side-panel highlight-box mt-5 me-5">
              <div className="circle me-3 mb-2">
                <FontAwesomeIcon icon={faInfo} />
              </div>
              Tag aliases are labels you can assign as synonyms for tags.
              <br />
              <br />
              An example might be the alias <span className="text-primary">math</span> for the tag{" "}
              <span className="text-primary">mathematics</span>
            </div>

            <TagAliasTable data={aliases} onDelete={handleDeleteAlias} />
          </div>
        </Card>

        <AddTagAliasModal
          ref={addAliasModalRef}
          tagSearchUrl={urls.tagSearchUrl}
          addAliasUrl={urls.addAliasUrl}
          onAliasAdded={handleAliasAdded}
        />
      </div>
    </div>
  );
}

export default TagListPage;
