import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { Card } from "./Card";
import { doGet } from "../utils/reactUtils";

interface RelatedTagInfo {
  tag_name: string;
  count: number;
}

interface TagListItem {
  name: string;
  related: RelatedTagInfo[];
}

interface RelatedTagsProps {
  relatedTagsUrl: string;
  docType?: string;
  initialTags?: string[];
  onClickTag?: (tag: string) => void;
}

export interface RelatedTagsHandle {
  setTags: (tags: string[]) => void;
}

export const RelatedTags = forwardRef<RelatedTagsHandle, RelatedTagsProps>(
  function RelatedTags(
    { relatedTagsUrl, docType = "", initialTags = [], onClickTag },
    ref
  ) {
    const [tagList, setTagList] = useState<TagListItem[]>([]);

    const getTagInfo = useCallback(
      (tags: string[]) => {
        setTagList([]);
        for (const tag of tags) {
          doGet(
            `${relatedTagsUrl}?tag_name=${encodeURIComponent(tag)}&doc_type=${docType}`,
            (response) => {
              if (response.data.info && response.data.info.length > 0) {
                setTagList((prev) => [
                  ...prev,
                  {
                    name: tag,
                    related: response.data.info,
                  },
                ]);
              }
            },
            "Error getting related tags"
          );
        }
      },
      [relatedTagsUrl, docType]
    );

    const handleTagClick = useCallback(
      (tag: string) => {
        onClickTag?.(tag);
      },
      [onClickTag]
    );

    useImperativeHandle(
      ref,
      () => ({
        setTags: (tags: string[]) => {
          getTagInfo(tags);
        },
      }),
      [getTagInfo]
    );

    // Load initial tags on mount
    React.useEffect(() => {
      if (initialTags && initialTags.length > 0) {
        getTagInfo(initialTags);
      }
    }, []);

    if (tagList.length === 0) {
      return null;
    }

    const titleSlot = (
      <div className="d-flex">
        <div className="card-title d-flex">
          <FontAwesomeIcon icon={faTags} className="text-primary me-3 mt-1" />
          Related Tags
        </div>
      </div>
    );

    return (
      <Card className="backdrop-filter" titleSlot={titleSlot}>
        {tagList.map((tagInfo) => (
          <div key={tagInfo.name}>
            <hr className="divider" />
            <h5 className="text-success">{tagInfo.name}</h5>
            <ul className="related-tags list-unstyled text-truncate ms-2 pb-1">
              {tagInfo.related.map((tag) => (
                <li
                  key={tag.tag_name}
                  className="mt-3 cursor-pointer"
                  onClick={() => handleTagClick(tag.tag_name)}
                >
                  <span className="tag">{tag.tag_name}</span>
                  <span className="count text-white ms-1">{tag.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    );
  }
);

export default RelatedTags;
