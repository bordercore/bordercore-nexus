import React from "react";
import { MagSection } from "./MagSection";
import { DrillRing } from "./DrillRing";
import { Bookshelf } from "./Bookshelf";
import { fillUrlTemplate } from "./utils";
import type { DefaultCollection, DrillProgress } from "../types";

interface StudyDeskColumnProps {
  drillProgress: DrillProgress;
  drillListUrl: string;
  defaultCollection: DefaultCollection | null;
  collectionDetailUrlTemplate: string;
}

export function StudyDeskColumn({
  drillProgress,
  drillListUrl,
  defaultCollection,
  collectionDetailUrlTemplate,
}: StudyDeskColumnProps) {
  return (
    <div className="mag-column">
      <MagSection accent="cyan" kicker={<a href={drillListUrl}>study desk</a>}>
        <div className="mag-block">
          <div className="mag-study">
            <DrillRing percent={drillProgress.percentage} />
            <div>
              <div className="mag-study-summary">
                <a href={drillListUrl}>{drillProgress.count} questions tracked</a>
              </div>
              <p className="mag-study-detail">
                mastered across all tags · {Math.round(drillProgress.percentage)}% complete
              </p>
            </div>
          </div>
        </div>

        {defaultCollection && (
          <div className="mag-block">
            <div className="mag-ucase">
              <a href={fillUrlTemplate(collectionDetailUrlTemplate, defaultCollection.uuid)}>
                current bookshelf · {defaultCollection.name.toLowerCase()}
              </a>
            </div>
            <Bookshelf blobs={defaultCollection.blob_list} />
          </div>
        )}
      </MagSection>
    </div>
  );
}
