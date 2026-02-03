import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBox, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doGet, doPost } from "../utils/reactUtils";
import type { NodeLayoutItem, NodeOptions, NodeInfo } from "./types";

interface NodeNodeProps {
  uuid: string;
  parentNodeUuid: string;
  nodeOptionsInitial: NodeOptions;
  getNodeInfoUrl: string;
  nodeDetailUrl: string;
  removeComponentUrl: string;
  editNodeUrl: string;
  onOpenNodeModal: (callback: (options: NodeOptions) => void, options: NodeOptions) => void;
  onEditLayout: (layout: string) => void;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export default function NodeNode({
  uuid,
  parentNodeUuid,
  nodeOptionsInitial,
  getNodeInfoUrl,
  nodeDetailUrl,
  removeComponentUrl,
  editNodeUrl,
  onOpenNodeModal,
  onEditLayout,
}: NodeNodeProps) {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo>({
    uuid: "",
    name: "",
    images: [],
    note_count: 0,
    todo_count: 0,
    random_note: null,
    random_todo: null,
  });
  const [nodeOptions, setNodeOptions] = useState<NodeOptions>(nodeOptionsInitial);

  const rotateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rotateIntervalNotesRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getNodeInfo();
    setTimer();

    return () => {
      if (rotateIntervalRef.current) {
        clearInterval(rotateIntervalRef.current);
      }
      if (rotateIntervalNotesRef.current) {
        clearInterval(rotateIntervalNotesRef.current);
      }
    };
  }, []);

  const getNodeInfo = (notesOnly: boolean = false) => {
    doGet(
      `${getNodeInfoUrl}?notesOnly=${notesOnly}`,
      response => {
        if (notesOnly) {
          setNodeInfo(prev => ({
            ...prev,
            random_note: response.data.info.random_note,
            random_todo: response.data.info.random_todo,
          }));
        } else {
          setNodeInfo(response.data.info);
        }
      },
      "Error getting node info"
    );
  };

  const handleRemoveNode = () => {
    doPost(
      removeComponentUrl,
      {
        node_uuid: parentNodeUuid,
        uuid: uuid,
      },
      response => {
        onEditLayout(response.data.layout);
      },
      "Node removed"
    );
  };

  const handleOpenNodeModal = () => {
    onOpenNodeModal(editNode, nodeOptions);
  };

  const setTimer = () => {
    if (nodeOptions.rotate && nodeOptions.rotate !== -1) {
      if (rotateIntervalRef.current) {
        clearInterval(rotateIntervalRef.current);
      }
      rotateIntervalRef.current = setInterval(
        () => {
          getNodeInfo();
        },
        nodeOptions.rotate * 1000 * 60
      );
    }

    // Create a separate timer for notes and todos (every minute)
    if (rotateIntervalNotesRef.current) {
      clearInterval(rotateIntervalNotesRef.current);
    }
    rotateIntervalNotesRef.current = setInterval(() => {
      getNodeInfo(true);
    }, 1000 * 60);
  };

  const editNode = (options: NodeOptions) => {
    doPost(
      editNodeUrl,
      {
        parent_node_uuid: parentNodeUuid,
        uuid: uuid,
        options: JSON.stringify(options),
      },
      response => {
        setNodeOptions(options);
        setTimer();
        onEditLayout(response.data.layout);
      },
      "Node edited"
    );
  };

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleOpenNodeModal();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit Node</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleRemoveNode();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Remove Node</span>
        </a>
      </li>
    </ul>
  );

  const titleSlot = (
    <div className="dropdown-height d-flex">
      <div className="card-title d-flex">
        <div className="text-truncate">
          <FontAwesomeIcon icon={faBox} className="text-primary me-3" />
          {nodeInfo && (
            <span>
              <a href={nodeDetailUrl}>{nodeInfo.name}</a>
            </span>
          )}
        </div>
      </div>
      <div className="dropdown-menu-container ms-auto">
        <DropDownMenu dropdownSlot={dropdownContent} />
      </div>
    </div>
  );

  return (
    <div className="hover-target">
      <Card cardClassName="backdrop-filter node-color-1" titleSlot={titleSlot}>
        <div className="d-flex">
          {nodeInfo.images.map(image => (
            <div key={image.uuid} className="w-50 me-2">
              <a href={image.blob_url} target="_blank" rel="noopener noreferrer">
                <img src={image.cover_url} className="mw-100" alt="" />
              </a>
            </div>
          ))}
        </div>
        <div id="node-node-misc">
          {nodeInfo.note_count > 0 && (
            <div className="text-truncate">
              <div className="d-flex">
                <div className="text-nowrap">
                  <strong>{nodeInfo.note_count}</strong> {pluralize("note", nodeInfo.note_count)}
                </div>
                {nodeInfo.random_note && (
                  <div className="text-truncate text-info ms-2">{nodeInfo.random_note.name}</div>
                )}
              </div>
            </div>
          )}
          {nodeInfo.todo_count > 0 && (
            <div>
              <div className="d-flex">
                <div className="text-nowrap">
                  <strong>{nodeInfo.todo_count}</strong> {pluralize("todo", nodeInfo.todo_count)}
                </div>
                {nodeInfo.random_todo && (
                  <div className="text-truncate text-info ms-2">{nodeInfo.random_todo.name}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
