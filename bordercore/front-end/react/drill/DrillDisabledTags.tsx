import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle, faEllipsisV, faPencilAlt } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
import { doGet, doPost } from "../utils/reactUtils";

interface DisabledTag {
  name: string;
  url: string;
  progress: number;
  count: number;
  last_reviewed: string;
}

interface DrillDisabledTagsProps {
  getDisabledTagsUrl: string;
  disableTagUrl: string;
  enableTagUrl: string;
  tagSearchUrl: string;
}

export function DrillDisabledTags({
  getDisabledTagsUrl,
  disableTagUrl,
  enableTagUrl,
  tagSearchUrl,
}: DrillDisabledTagsProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [tagList, setTagList] = useState<DisabledTag[]>([]);

  const selectValueRef = useRef<SelectValueHandle>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  const getTagList = useCallback(() => {
    doGet(
      getDisabledTagsUrl,
      (response: any) => {
        setTagList(response.data.tag_list);
        setDataLoading(false);
      },
      "Error getting disabled tags"
    );
  }, [getDisabledTagsUrl]);

  useEffect(() => {
    getTagList();
  }, [getTagList]);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);
    }
  }, []);

  const handleTagDisable = useCallback(
    (tag: string) => {
      doPost(
        disableTagUrl,
        { tag },
        () => {
          getTagList();
        }
      );
    },
    [disableTagUrl, getTagList]
  );

  const handleTagEnable = useCallback(
    (tagName: string) => {
      doPost(
        enableTagUrl,
        { tag: tagName },
        () => {
          getTagList();
        }
      );
    },
    [enableTagUrl, getTagList]
  );

  const handleTagSelect = useCallback(
    (selection: any) => {
      handleTagDisable(selection.label || selection.name);
    },
    [handleTagDisable]
  );

  const openModal = useCallback(() => {
    if (modalInstanceRef.current) {
      modalInstanceRef.current.show();
      setTimeout(() => {
        selectValueRef.current?.focus();
      }, 500);
    }
  }, []);

  const titleSlot = (
    <div className="card-title d-flex align-items-center">
      <div>Disabled Tags</div>
      <div className="ms-auto">
        <DropDownMenu
          showOnHover={true}
          iconSlot={<FontAwesomeIcon icon={faEllipsisV} />}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li key="manage">
                <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); openModal(); }}>
                  <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" />
                  Manage
                </a>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );

  return (
    <div className="d-flex flex-grow-1">
      {/* Modal for managing disabled tags */}
      <div
        ref={modalRef}
        id="modalDisabledTags"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Disabled Tags
              </h4>
              <button
                type="button"
                className="close-button btn-close"
                data-bs-dismiss="modal"
              />
            </div>
            <div className="modal-body">
              <div className="form-row align-items-center">
                <div className="form-row mx-1 w-100">
                  <SelectValue
                    ref={selectValueRef}
                    searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                    placeHolder="Search Tag"
                    onSelect={handleTagSelect}
                  />
                </div>
              </div>
              <ul
                id="drill-pinned-tags"
                className="interior-borders p-2 mb-0 wide-list"
              >
                <div className="slicklist-list-item-inner">
                  {tagList.map((tag) => (
                    <li key={tag.name} className="list-group-item px-2 py-1">
                      <div className="d-flex">
                        <div>{tag.name}</div>
                        <div className="ms-auto my-auto">
                          <FontAwesomeIcon
                            icon={faTimesCircle}
                            className="list-delete"
                            onClick={() => handleTagEnable(tag.name)}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </div>
              </ul>
            </div>
            <div className="modal-footer justify-content-start">
              <input
                className="btn btn-primary"
                type="button"
                value="Save"
                data-bs-dismiss="modal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card component */}
      <Card
        className="backdrop-filter hover-target flex-grow-1"
        cardClassName="flex-grow-1"
        titleSlot={titleSlot}
      >
        <hr className="divider" />
        {dataLoading ? (
          <div className="text-secondary">Data Loading...</div>
        ) : (
          <ul className="list-unstyled">
            {tagList.map((tag) => (
              <li key={tag.name} className="d-flex px-2">
                <div className="item-name flex-fill">
                  <a href={`${tag.url}?filter=review`}>{tag.name}</a>
                </div>
                <div className="item-value">{tag.progress}%</div>
              </li>
            ))}
            {tagList.length === 0 && (
              <li key="add-tag">
                <a href="#" onClick={(e) => { e.preventDefault(); openModal(); }}>
                  Add a tag
                </a>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default DrillDisabledTags;
