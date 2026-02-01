import React, { useState, useRef, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { Collection, CollectionListUrls } from "./types";
import CollectionCard from "./CollectionCard";
import CreateCollectionModal, { CreateCollectionModalHandle } from "./CreateCollectionModal";
import DropDownMenu from "../common/DropDownMenu";

interface CollectionListPageProps {
  collections: Collection[];
  urls: CollectionListUrls;
  csrfToken: string;
}

export function CollectionListPage({ collections, urls, csrfToken }: CollectionListPageProps) {
  const [filter, setFilter] = useState<string>("");
  const [showFilterInput, setShowFilterInput] = useState(false);
  const [filterInputValue, setFilterInputValue] = useState("");
  const createModalRef = useRef<CreateCollectionModalHandle>(null);

  const filteredCollections = useMemo(() => {
    if (!filter) {
      return collections;
    }
    const regex = new RegExp(`.*${filter}.*`, "i");
    return collections.filter(c => regex.test(c.name));
  }, [collections, filter]);

  const handleCollectionClick = (url: string) => {
    window.location.href = url;
  };

  const handleFilterClick = () => {
    setShowFilterInput(true);
    setTimeout(() => {
      const el = document.getElementById("collection-filter-input");
      el?.focus();
    }, 100);
  };

  const handleFilterBlur = () => {
    setShowFilterInput(false);
  };

  const handleFilterEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setShowFilterInput(false);
      setFilter(filterInputValue);
    }
  };

  const handleRemoveFilter = () => {
    setFilter("");
    setFilterInputValue("");
  };

  const handleCreateClick = () => {
    createModalRef.current?.openModal();
  };

  const menuLinks = [
    {
      id: "new-collection",
      title: "New Collection",
      url: "#",
      icon: "plus" as const,
      clickHandler: handleCreateClick,
    },
  ];

  return (
    <>
      <div className="row card-grid">
        <div className="col-lg-12 d-flex align-items-center">
          <h1 className="ms-3">Favorite Collections</h1>
          <div className="d-flex align-items-center ms-auto">
            {showFilterInput && (
              <div id="collection-filter" className="me-3">
                <input
                  id="collection-filter-input"
                  type="text"
                  className="form-control"
                  size={20}
                  placeholder="Name"
                  value={filterInputValue}
                  onChange={e => setFilterInputValue(e.target.value)}
                  onBlur={handleFilterBlur}
                  onKeyUp={handleFilterEnter}
                />
              </div>
            )}

            {filter && (
              <div className="tag d-flex align-items-center me-3">
                <div>
                  Filter: <strong>{filter}</strong>
                </div>
                <div>
                  <a
                    className="ms-1"
                    href="#"
                    onClick={e => {
                      e.preventDefault();
                      handleRemoveFilter();
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-primary" />
                  </a>
                </div>
              </div>
            )}

            <div className="ms-2 me-5 cursor-pointer" onClick={handleFilterClick}>
              <FontAwesomeIcon icon={faMagnifyingGlass} className="glow text-emphasis" />
            </div>

            <DropDownMenu
              links={menuLinks}
              dropdownSlot={
                <ul className="dropdown-menu-list">
                  <li>
                    <a
                      href="#"
                      className="dropdown-menu-item"
                      onClick={e => {
                        e.preventDefault();
                        handleCreateClick();
                      }}
                    >
                      <span className="dropdown-menu-icon">
                        <FontAwesomeIcon icon={faPlus} className="text-primary" />
                      </span>
                      <span className="dropdown-menu-text">New Collection</span>
                    </a>
                  </li>
                </ul>
              }
            />
          </div>
        </div>

        <div className="col-lg-12">
          <hr className="collection-list-divider" />
        </div>

        <div className="card-grid ms-3">
          <div className="d-flex flex-wrap">
            {filteredCollections.map(collection => (
              <CollectionCard
                key={collection.uuid}
                collection={collection}
                onClick={handleCollectionClick}
              />
            ))}
            {collections.length === 0 && (
              <div className="notice-big px-3">No collections found</div>
            )}
          </div>
        </div>
      </div>

      <CreateCollectionModal
        ref={createModalRef}
        createUrl={urls.createCollection}
        tagSearchUrl={urls.tagSearch}
        csrfToken={csrfToken}
      />
    </>
  );
}

export default CollectionListPage;
