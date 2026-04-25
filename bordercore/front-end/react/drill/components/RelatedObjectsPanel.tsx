import React, { forwardRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import RelatedObjects, { RelatedObjectsHandle } from "../../common/RelatedObjects";

interface RelatedObjectsPanelProps {
  objectUuid: string;
  relatedObjectsUrl: string;
  newObjectUrl: string;
  removeObjectUrl: string;
  sortRelatedObjectsUrl: string;
  editRelatedObjectNoteUrl: string;
  searchNamesUrl: string;
  onOpenObjectSelectModal: () => void;
}

export const RelatedObjectsPanel = forwardRef<RelatedObjectsHandle, RelatedObjectsPanelProps>(
  function RelatedObjectsPanel(props, ref) {
    return (
      <div className="dpanel">
        <div className="dpanel-head">
          <h3>
            <FontAwesomeIcon icon={faBookmark} />
            Related Objects
          </h3>
        </div>
        <RelatedObjects
          ref={ref}
          objectUuid={props.objectUuid}
          nodeType="drill"
          relatedObjectsUrl={props.relatedObjectsUrl}
          newObjectUrl={props.newObjectUrl}
          removeObjectUrl={props.removeObjectUrl}
          sortRelatedObjectsUrl={props.sortRelatedObjectsUrl}
          editRelatedObjectNoteUrl={props.editRelatedObjectNoteUrl}
          searchNamesUrl={props.searchNamesUrl}
          showEmptyList={true}
          onOpenObjectSelectModal={props.onOpenObjectSelectModal}
        />
      </div>
    );
  }
);

export default RelatedObjectsPanel;
