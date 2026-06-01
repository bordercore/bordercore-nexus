import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTerminal, faShuffle } from "@fortawesome/free-solid-svg-icons";
import AnswerVeil from "./AnswerVeil";
import RatingBar, { RatingKey } from "./RatingBar";
import { tagStyle } from "../../utils/tagColors";

interface IntervalEntry {
  description: string;
  days: number;
  interval_index: number;
}

interface QuestionCardProps {
  questionHtml: string;
  answerHtml: string;
  tags: { name: string }[];
  intervals: Record<string, IntervalEntry>;
  currentIntervalDays: number;
  currentIntervalIndex: number;
  revealed: boolean;
  onReveal: () => void;
  onRate: (key: RatingKey) => void;
  onSkip: () => void;
  sqlPlaygroundUrl: string | null;
  startStudySessionUrl: string;
  canRephrase: boolean;
  isRephrased: boolean;
  rephraseLoading: boolean;
  rephraseError: string | null;
  onRephrase: () => void;
  onShowOriginal: () => void;
}

export function QuestionCard({
  questionHtml,
  answerHtml,
  tags,
  intervals,
  currentIntervalDays,
  currentIntervalIndex,
  revealed,
  onReveal,
  onRate,
  onSkip,
  sqlPlaygroundUrl,
  startStudySessionUrl,
  canRephrase,
  isRephrased,
  rephraseLoading,
  rephraseError,
  onRephrase,
  onShowOriginal,
}: QuestionCardProps) {
  return (
    <div className="qcard">
      <div className="qcard-body">
        {/* Markdown rendered upstream from user-owned content; same pattern as the previous page. */}
        <div className="q-prompt" dangerouslySetInnerHTML={{ __html: questionHtml }} />

        {tags.length > 0 && (
          <div className="tags-row tags-row-compact">
            <span className="label">tags</span>
            {tags.map(t => (
              <a
                key={t.name}
                className="tag-chip"
                href={`${startStudySessionUrl}?study_method=tag&tags=${encodeURIComponent(t.name)}`}
                style={tagStyle(t.name)} // must remain inline
              >
                {t.name}
              </a>
            ))}
          </div>
        )}

        <div className="section-h">Answer</div>
        <AnswerVeil revealed={revealed} onReveal={onReveal}>
          <div
            className="schema-block answer-block"
            dangerouslySetInnerHTML={{ __html: answerHtml }}
          />
        </AnswerVeil>
      </div>

      <RatingBar
        intervals={intervals}
        currentIntervalDays={currentIntervalDays}
        currentIntervalIndex={currentIntervalIndex}
        revealed={revealed}
        onRate={onRate}
      />

      <div className="utility-row">
        {canRephrase && (
          <div className="rephrase-group">
            {rephraseError && (
              <span className="qcard-rephrase-error" role="alert">
                {rephraseError}
              </span>
            )}
            {isRephrased && !rephraseLoading && (
              <button type="button" className="ghost-btn" onClick={onShowOriginal}>
                show original
              </button>
            )}
            <button
              type="button"
              className="play-btn"
              onClick={onRephrase}
              disabled={rephraseLoading}
              title={isRephrased ? "Get another variant" : "Rephrase this question"}
            >
              <FontAwesomeIcon icon={faShuffle} className="play-btn-icon" />
              {rephraseLoading ? "rephrasing…" : isRephrased ? "rephrase again" : "rephrase"}
            </button>
          </div>
        )}
        <div className="right">
          <button type="button" className="ghost-btn" onClick={onSkip}>
            skip
          </button>
          {sqlPlaygroundUrl && (
            <a className="play-btn" href={sqlPlaygroundUrl} target="_blank" rel="noreferrer">
              <FontAwesomeIcon icon={faTerminal} className="play-btn-icon" />
              SQL Playground
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuestionCard;
