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
  needsReview: boolean;
  isDisabled: boolean;
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
  needsReview,
  isDisabled,
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
      <div className="qcard-toolbar">
        <span className="dot dot-danger" />
        <span className="dot dot-warn" />
        <span className="dot dot-ok" />
        {needsReview && <span className="due">● needs review</span>}
        {isDisabled && <span className="due">● disabled</span>}
        {canRephrase && (
          <div className="qcard-toolbar-rephrase">
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
            {isRephrased && !rephraseLoading && (
              <button type="button" className="ghost-btn" onClick={onShowOriginal}>
                show original
              </button>
            )}
            {rephraseError && (
              <span className="qcard-rephrase-error" role="alert">
                {rephraseError}
              </span>
            )}
          </div>
        )}
      </div>

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
        <div className="keys">
          <span>
            <kbd>space</kbd> reveal
          </span>
          <span>
            <kbd>1</kbd>–<kbd>4</kbd> rate
          </span>
          <span>
            <kbd>s</kbd> skip
          </span>
          <span>
            <kbd>f</kbd> favorite
          </span>
        </div>
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
