import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faExternalLinkAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doPost } from "../utils/reactUtils";

interface NodeImageProps {
  uuid: string;
  nodeUuid: string;
  imageTitle: string;
  imageUrl: string;
  imageDetailUrl: string;
  removeComponentUrl: string;
  onOpenImageModal: (imageUrl: string) => void;
  onEditLayout: (layout: string) => void;
}

export default function NodeImage({
  uuid,
  nodeUuid,
  imageTitle,
  imageUrl,
  imageDetailUrl,
  removeComponentUrl,
  onOpenImageModal,
  onEditLayout,
}: NodeImageProps) {
  const handleRemoveImage = () => {
    doPost(
      removeComponentUrl,
      {
        node_uuid: nodeUuid,
        uuid: uuid,
      },
      (response) => {
        onEditLayout(response.data.layout);
      },
      "Image removed"
    );
  };

  const handleImageClick = () => {
    onOpenImageModal(imageUrl);
  };

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href={imageDetailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dropdown-menu-item"
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Media detail</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleRemoveImage();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faTimes} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Remove media</span>
        </a>
      </li>
    </ul>
  );

  const titleSlot = (
    <div className="dropdown-height d-flex">
      <div className="card-title d-flex">
        <div>
          <FontAwesomeIcon icon={faImage} className="text-primary me-3" />
          {imageTitle}
        </div>
      </div>
      <div className="dropdown-menu-container ms-auto">
        <DropDownMenu showOnHover dropdownSlot={dropdownContent} />
      </div>
    </div>
  );

  return (
    <div className="hover-target">
      <Card cardClassName="backdrop-filter node-color-1" titleSlot={titleSlot}>
        <img
          src={imageUrl}
          className="mw-100 cursor-pointer"
          onClick={handleImageClick}
          alt={imageTitle}
        />
      </Card>
    </div>
  );
}
