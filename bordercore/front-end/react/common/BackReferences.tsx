import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestion, faCopy } from "@fortawesome/free-solid-svg-icons";
import markdownit from "markdown-it";
import { Card } from "./Card";

interface BackReference {
  uuid: string;
  type: "question" | "blob";
  question?: string;
  name?: string;
  url: string;
  cover_url?: string;
  tags: string[];
}

interface BackReferencesProps {
  backReferences: BackReference[];
}

export function BackReferences({ backReferences }: BackReferencesProps) {
  const markdown = useMemo(() => markdownit(), []);

  const getMarkdown = (content: string): string => {
    return markdown.render(content);
  };

  const handleNodeClick = (url: string) => {
    window.location.href = url;
  };

  if (backReferences.length === 0) {
    return null;
  }

  return (
    <Card title="Back references">
      <hr className="divider" />
      <ul className="list-group interior-borders cursor-pointer text-truncate">
        {backReferences.map(node => (
          <li
            key={node.uuid}
            className="hoverable px-0 list-group-item list-group-item-secondary text-primary"
          >
            {node.type === "question" && (
              <div className="d-flex">
                <div className="mt-1 me-2">
                  <FontAwesomeIcon icon={faQuestion} className="text-success" />
                </div>
                <div>
                  {/* Content is trusted server-rendered markdown from the app's own database */}
                  <div
                    className="back-reference cursor-pointer"
                    onClick={() => handleNodeClick(node.url)}
                    dangerouslySetInnerHTML={{
                      __html: getMarkdown(node.question || ""),
                    }}
                  />
                  <div className="pt-2">
                    {node.tags.map(tag => (
                      <span key={tag} className="tag me-2">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {node.type === "blob" && (
              <div className="d-flex">
                <div className="mt-1 me-2">
                  <FontAwesomeIcon icon={faCopy} className="text-success" />
                </div>
                <div className="text-truncate">
                  {node.cover_url && <img src={node.cover_url} className="mw-100" alt="" />}
                  {/* Content is trusted server-rendered HTML from the app's own database */}
                  <div
                    className="text-truncate cursor-pointer"
                    onClick={() => handleNodeClick(node.url)}
                    dangerouslySetInnerHTML={{ __html: node.name || "" }}
                  />
                  <div className="pt-2">
                    {node.tags.map(tag => (
                      <span key={tag} className="tag me-2">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default BackReferences;
