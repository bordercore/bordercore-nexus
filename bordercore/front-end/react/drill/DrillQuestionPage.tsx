import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faPlus,
  faHome,
  faPencilAlt,
  faComment,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { faPython } from "@fortawesome/free-brands-svg-icons";
import hotkeys from "hotkeys-js";
import MarkdownIt from "markdown-it";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-markdown";

// Add copy button to code blocks after Prism highlighting
// Based on util.js addCopyButton() - uses wrapper div because pre has
// overflow:auto for scrollbars, and we don't want button to scroll
Prism.hooks.add("complete", (env) => {
  const code = env.element as HTMLElement;
  const pre = code.parentNode as HTMLElement;

  // Skip if not in a pre element
  if (!pre || pre.tagName !== "PRE") {
    return;
  }

  // Skip if wrapper already exists (already processed)
  if (pre.parentElement?.classList.contains("code-block-wrapper")) {
    return;
  }

  // Create wrapper div - button is positioned relative to this, not pre
  // This prevents button from scrolling with code content
  const wrapper = document.createElement("div");
  wrapper.className = "code-block-wrapper";

  // Replace pre with wrapper, put pre inside
  pre.parentNode?.replaceChild(wrapper, pre);
  wrapper.appendChild(pre);

  // Create copy button
  const button = document.createElement("button");
  button.className = "copy-button";
  button.setAttribute("type", "button");

  const linkSpan = document.createElement("span");
  linkSpan.textContent = "Copy";
  button.appendChild(linkSpan);

  button.addEventListener("click", () => {
    if (navigator.clipboard) {
      const textContent = code.textContent?.replaceAll(/^\$ /gm, "") || "";
      navigator.clipboard.writeText(textContent);
      linkSpan.textContent = "Copied!";
      setTimeout(() => {
        linkSpan.textContent = "Copy";
      }, 2000);
    }
  });

  // Button is child of wrapper (sibling of pre), not inside pre
  wrapper.appendChild(button);
});

import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import DrillTagProgress from "../homepage/DrillTagProgress";
import RelatedObjects, { RelatedObjectsHandle } from "../common/RelatedObjects";
import ObjectSelectModal, { ObjectSelectModalHandle } from "../common/ObjectSelectModal";
import PythonConsole, { PythonConsoleHandle } from "../common/PythonConsole";
import { doGet, doPost, EventBus } from "../utils/reactUtils";
import { animateCSS } from "../../util.js";

// Initialize markdown parser
// Note: dangerouslySetInnerHTML is used below to render markdown as HTML.
// This matches the existing Vue behavior (v-html) and the content is the user's
// own questions/answers, not untrusted external content.
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface TagInfo {
  name: string;
  count: number;
  progress: number;
}

interface ResponseInterval {
  description: string;
}

interface StudySession {
  type: string;
  tag?: string;
  list: string[];
}

interface DrillQuestionPageProps {
  question: {
    uuid: string;
    question: string;
    answer: string;
    lastReviewed: string | null;
    interval: number;
    needsReview: boolean;
    isFavorite: boolean;
    isDisabled: boolean;
    isReversible: boolean;
    tags: { name: string }[];
  };
  lastResponse: string | null;
  tagInfo: TagInfo[];
  intervals: Record<string, ResponseInterval>;
  reverseQuestion: boolean;
  studySessionProgress: number;
  studySession: StudySession | null;
  sqlDb: { blob: { uuid: string } } | null;
  urls: {
    drillList: string;
    drillAdd: string;
    drillAddWithTag: string;
    drillUpdate: string;
    drillStudy: string;
    recordResponseGood: string;
    recordResponseHard: string;
    recordResponseEasy: string;
    recordResponseReset: string;
    isFavoriteMutate: string;
    relatedObjects: string;
    newObject: string;
    removeObject: string;
    sortRelatedObjects: string;
    editRelatedObjectNote: string;
    searchNames: string;
    getRelatedTags: string;
    sqlPlayground: string;
    startStudySession: string;
  };
  currentPath: string;
}

export function DrillQuestionPage({
  question,
  lastResponse,
  tagInfo,
  intervals,
  reverseQuestion: initialReverseQuestion,
  studySessionProgress,
  studySession,
  sqlDb,
  urls,
  currentPath,
}: DrillQuestionPageProps) {
  const [mode, setMode] = useState<"question" | "answer">("question");
  const [isFavorite, setIsFavorite] = useState(question.isFavorite);
  const [intervalString, setIntervalString] = useState("");
  const [showPythonConsoleFlag, setShowPythonConsoleFlag] = useState(false);
  const [reverseQuestion] = useState(initialReverseQuestion);

  const questionRef = useRef<HTMLDivElement>(null);
  const objectSelectModalRef = useRef<ObjectSelectModalHandle>(null);
  const relatedObjectsRef = useRef<RelatedObjectsHandle>(null);
  const favoriteIconRef = useRef<HTMLSpanElement>(null);
  const pythonConsoleRef = useRef<PythonConsoleHandle>(null);

  // Render markdown content
  const renderedQuestion = useMemo(() => {
    return md.render(question.question);
  }, [question.question]);

  const renderedAnswer = useMemo(() => {
    return md.render(question.answer);
  }, [question.answer]);

  // Get the question or answer based on reverse mode
  const getQuestion = useCallback(() => {
    return reverseQuestion ? renderedAnswer : renderedQuestion;
  }, [reverseQuestion, renderedQuestion, renderedAnswer]);

  const getAnswer = useCallback(() => {
    return reverseQuestion ? renderedQuestion : renderedAnswer;
  }, [reverseQuestion, renderedQuestion, renderedAnswer]);

  // Handle favorite toggle
  const handleFavoriteClick = useCallback(
    () => {
      const newFavorite = !isFavorite;

      // Animate using ref before state change to avoid stale DOM reference
      if (favoriteIconRef.current) {
        animateCSS(favoriteIconRef.current, "heartBeat");
      }

      setIsFavorite(newFavorite);

      doPost(
        urls.isFavoriteMutate,
        {
          question_uuid: question.uuid,
          mutation: newFavorite ? "add" : "delete",
        },
        () => {}
      );
    },
    [isFavorite, question.uuid, urls.isFavoriteMutate]
  );

  // Handle showing the answer
  const handleShowAnswer = useCallback(() => {
    setMode("answer");

    // Re-run MathJax and Prism after state update
    setTimeout(() => {
      if (typeof (window as any).MathJax?.typeset === "function") {
        (window as any).MathJax.typeset();
      }
      Prism.highlightAll();
    }, 10);
  }, []);

  // Handle response mouse over/out
  const handleMouseOverResponse = useCallback(
    (response: string) => {
      const interval = intervals[response];
      if (interval) {
        setIntervalString(interval.description);
      }
    },
    [intervals]
  );

  const handleMouseOutResponse = useCallback(() => {
    setIntervalString("");
  }, []);

  // Handle chat bot
  const handleAskChatbot = useCallback(() => {
    // Emit event for chatbot using EventBus (same as base-react.tsx)
    EventBus.$emit("chat", { questionUuid: question.uuid });
  }, [question.uuid]);

  // Handle Python console
  const handleShowPythonConsole = useCallback(() => {
    setShowPythonConsoleFlag(true);
  }, []);

  // Handle opening object select modal
  const handleOpenObjectSelectModal = useCallback(() => {
    objectSelectModalRef.current?.open();
  }, []);

  // Handle object selection from modal
  const handleObjectSelected = useCallback(
    (selectedObject: { uuid: string; name: string }) => {
      doPost(
        urls.newObject,
        {
          node_uuid: question.uuid,
          object_uuid: selectedObject.uuid,
          node_type: "drill",
        },
        () => {
          relatedObjectsRef.current?.refresh();
        }
      );
    },
    [urls.newObject, question.uuid]
  );

  // Initialize MathJax and keyboard shortcuts
  useEffect(() => {
    // Configure MathJax only if not already configured
    if (!(window as any).MathJax?.tex) {
      (window as any).MathJax = {
        tex: {
          inlineMath: [
            ["\\(", "\\)"],
            ["$$", "$$"],
          ],
          displayMath: [["\\[", "\\]"]],
          processEscapes: true,
          processEnvironments: true,
        },
      };
    }

    // Reveal the question after a short delay
    setTimeout(() => {
      if (questionRef.current) {
        questionRef.current.classList.remove("d-none");
      }
      // Run MathJax and Prism
      if (typeof (window as any).MathJax?.typeset === "function") {
        (window as any).MathJax.typeset();
      }
      Prism.highlightAll();
    }, 10);

    // Set up keyboard shortcuts
    hotkeys.filter = function () {
      return true;
    };

    const handleHotkey = (event: KeyboardEvent, handler: any) => {
      // Ignore if typing in an input
      if ((document.activeElement as HTMLElement)?.tagName === "INPUT") {
        return;
      }
      // Ignore if in Python console textarea
      if (
        (event.target as HTMLElement)?.parentElement?.classList.contains(
          "code-input"
        )
      ) {
        return;
      }

      switch (handler.key) {
        case "right":
          window.location.href = urls.drillStudy;
          break;
        case "space":
          event.preventDefault();
          handleShowAnswer();
          break;
        case "e":
          if (mode === "answer") {
            window.location.href = urls.recordResponseEasy;
          }
          break;
        case "g":
          if (mode === "answer") {
            window.location.href = urls.recordResponseGood;
          }
          break;
        case "h":
          if (mode === "answer") {
            window.location.href = urls.recordResponseHard;
          }
          break;
        case "r":
          if (mode === "answer") {
            window.location.href = urls.recordResponseReset;
          }
          break;
      }
    };

    hotkeys("right,space,e,g,h,r", handleHotkey);

    return () => {
      hotkeys.unbind("right,space,e,g,h,r");
    };
  }, [mode, urls, handleShowAnswer]);

  // Get study session description for breadcrumb
  const getSessionDescription = () => {
    if (!studySession) {
      return "Ad-hoc study session";
    }

    switch (studySession.type) {
      case "favorites":
        return "Studying favorite questions.";
      case "tag":
        const hasMultipleTags = studySession.tag?.includes(",");
        return (
          <>
            Studying tag{hasMultipleTags ? "s" : ""}{" "}
            <strong>{studySession.tag}</strong>.
          </>
        );
      case "random":
        return "Studying random questions.";
      default:
        return null;
    }
  };

  const favoriteClass = isFavorite ? "favorite" : "";
  const favoriteTooltip = isFavorite
    ? "Remove this as a favorite"
    : "Add this as a favorite";

  const addQuestionUrl = question.tags.length > 0
    ? urls.drillAddWithTag
    : urls.drillAdd;

  return (
    <>
      <div className="d-flex flex-column flex-grow-1 min-h-0">
      {/* Navigation Bar */}
      <div className="d-flex mb-3 me-3 flex-shrink-0">
        <div className="me-auto align-self-center">
          <ul className="breadcrumb mb-0 pt-0 pb-0">
            <li className="breadcrumb-item">
              <a href={urls.drillList}>
                <FontAwesomeIcon icon={faHome} className="icon-hover glow" />
              </a>
            </li>
            <li className="breadcrumb-item active">
              {getSessionDescription()}
              {studySession && (
                <>
                  {" "}
                  <strong>{studySessionProgress}</strong> out of{" "}
                  <strong>{studySession.list.length}</strong> questions completed.
                </>
              )}
            </li>
          </ul>
        </div>

        <div id="icon-list" className="d-flex align-items-center">
          <span
            ref={favoriteIconRef}
            onClick={handleFavoriteClick}
            data-bs-toggle="tooltip"
            data-placement="bottom"
            title={favoriteTooltip}
            className="icon-clickable"
          >
            <FontAwesomeIcon
              icon={faHeart}
              className={`icon-hover glow ${favoriteClass}`}
            />
          </span>
          <FontAwesomeIcon
            icon={faPython}
            className="icon-hover glow ms-3 cursor-pointer"
            onClick={handleShowPythonConsole}
            data-bs-toggle="tooltip"
            data-placement="bottom"
            title="Open Python Console"
          />
          <FontAwesomeIcon
            icon={faComment}
            className="icon-hover glow ms-3 cursor-pointer"
            onClick={handleAskChatbot}
            data-bs-toggle="tooltip"
            data-placement="bottom"
            title="Ask AI"
          />
          <a href={addQuestionUrl} className="link-inherit">
            <FontAwesomeIcon
              icon={faPlus}
              className="icon-hover glow ms-3"
              data-bs-toggle="tooltip"
              data-placement="bottom"
              title="New Question"
            />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="row g-0 flex-grow-1 min-h-0 mx-2">
        {/* Left sidebar */}
        <div className="flex-grow-last col-lg-3 d-flex flex-column">
          {/* Question info card */}
          <div className="card mb-gutter drill-info-card">
            <div className="card-body backdrop-filter">
              <div className="d-flex">
                <div className="flex-grow-1">
                  <ul className="list-unstyled mb-0">
                    <li className="d-flex">
                      <div className="text-name flex-fill fw-bold">Reviewed</div>
                      <div className="text-value text-end">
                        {question.lastReviewed || "Never"}
                      </div>
                    </li>
                    <li className="d-flex">
                      <div className="text-name flex-fill fw-bold">Last Response</div>
                      <div className="text-value text-end">
                        {lastResponse
                          ? lastResponse.charAt(0).toUpperCase() + lastResponse.slice(1)
                          : "N/A"}
                      </div>
                    </li>
                    <li className="d-flex">
                      <div className="text-name flex-fill fw-bold">Interval</div>
                      <div className="text-value">
                        {question.interval} day{question.interval !== 1 ? "s" : ""}
                      </div>
                    </li>
                    <li className="d-flex">
                      <div className="text-name flex-fill fw-bold">Needs Review</div>
                      <div className="text-value">
                        {question.needsReview ? "Yes" : "No"}
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Related Objects */}
          <RelatedObjects
            ref={relatedObjectsRef}
            objectUuid={question.uuid}
            nodeType="drill"
            relatedObjectsUrl={urls.relatedObjects}
            newObjectUrl={urls.newObject}
            removeObjectUrl={urls.removeObject}
            sortRelatedObjectsUrl={urls.sortRelatedObjects}
            editRelatedObjectNoteUrl={urls.editRelatedObjectNote}
            searchNamesUrl={urls.searchNames}
            showEmptyList={true}
            onOpenObjectSelectModal={handleOpenObjectSelectModal}
          />

          {/* Tag Progress Card */}
          <Card
            className="backdrop-filter"
            titleSlot={
              <div className="card-title d-flex align-items-center mb-3">
                <FontAwesomeIcon icon={faTags} className="text-primary me-3 mt-1" />
                Tag Progress
              </div>
            }
          >
            <hr className="divider" />
            <div className="d-flex flex-column justify-content-center">
              {tagInfo.map((tag) => (
                <DrillTagProgress
                  key={tag.name}
                  count={tag.count}
                  progress={tag.progress}
                  titleSlot={<span className="text-secondary mt-2 mb-2">{tag.name}</span>}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Main content area */}
        <div className="col-lg-9 ps-gutter d-flex flex-column flex-grow-1 min-h-0">
          <div className="card me-2 flex-shrink-0">
            <div
              ref={questionRef}
              id="question"
              className="hover-reveal-target card-body d-none"
            >
            {/* Question - uses dangerouslySetInnerHTML to match Vue v-html behavior for markdown */}
            <div className="d-flex">
              <h3
                className="drill-text table-colors markdown mw-100 w-100"
                dangerouslySetInnerHTML={{ __html: getQuestion() }}
              />
            </div>

            {/* Tags */}
            {question.tags.length > 0 && (
              <div className="mt-3">
                Tags:{" "}
                {question.tags.map((tag) => (
                  <a
                    key={tag.name}
                    className="tag me-1"
                    href={`${urls.startStudySession}?study_method=tag&tags=${tag.name}`}
                  >
                    {tag.name}
                  </a>
                ))}
              </div>
            )}

            {question.isDisabled && (
              <span className="question-disabled ms-3">Disabled</span>
            )}

            {/* Buttons */}
            <div className="d-flex mt-5">
              {sqlDb && (
                <a
                  href={`${urls.sqlPlayground}?sql_db_uuid=${sqlDb.blob.uuid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary me-2"
                  role="button"
                >
                  SQL Playground
                </a>
              )}
              <a
                href="#"
                className="btn btn-primary"
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleShowAnswer();
                }}
              >
                Show Answer
              </a>
              <a href={urls.drillStudy} className="btn btn-primary ms-2" role="button">
                Skip
              </a>
              <div className="dropdown-menu-container dropdown-menu-container-width ms-auto">
                <DropDownMenu
                  showOnHover={false}
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      <li key="edit">
                        <a
                          className="dropdown-item"
                          href={`${urls.drillUpdate}?return_url=${currentPath}`}
                        >
                          <span>
                            <FontAwesomeIcon
                              icon={faPencilAlt}
                              className="text-primary me-3"
                            />
                          </span>
                          Edit
                        </a>
                      </li>
                    </ul>
                  }
                />
              </div>
            </div>

            {/* Answer section - uses dangerouslySetInnerHTML to match Vue v-html behavior */}
            {mode === "answer" && (
              <div className="fade-in">
                <hr className="divider mt-3" />
                <h3
                  className="drill-text table-colors markdown"
                  dangerouslySetInnerHTML={{ __html: getAnswer() }}
                />

                <div className="d-flex mt-5">
                  <div>
                    <a
                      href={urls.recordResponseGood}
                      className="btn btn-primary"
                      role="button"
                      onMouseOver={() => handleMouseOverResponse("good")}
                      onMouseOut={handleMouseOutResponse}
                    >
                      Good
                    </a>
                    <a
                      href={urls.recordResponseHard}
                      className="btn btn-primary ms-2"
                      role="button"
                      onMouseOver={() => handleMouseOverResponse("hard")}
                      onMouseOut={handleMouseOutResponse}
                    >
                      Hard
                    </a>
                    <a
                      href={urls.recordResponseEasy}
                      className="btn btn-primary ms-2"
                      role="button"
                      onMouseOver={() => handleMouseOverResponse("easy")}
                      onMouseOut={handleMouseOutResponse}
                    >
                      Easy
                    </a>
                    <a
                      href={urls.recordResponseReset}
                      className="btn btn-primary ms-2"
                      role="button"
                      onMouseOver={() => handleMouseOverResponse("reset")}
                      onMouseOut={handleMouseOutResponse}
                    >
                      Reset
                    </a>
                    <a
                      href={urls.drillStudy}
                      className="btn btn-primary ms-2"
                      role="button"
                    >
                      Skip
                    </a>
                  </div>
                  <div
                    className="text-primary ms-auto align-self-end"
                    dangerouslySetInnerHTML={{ __html: intervalString }}
                  />
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Python console */}
          {showPythonConsoleFlag && (
            <div className="card-body me-2 mt-4 flex-grow-1 min-h-0 d-flex flex-column">
              <PythonConsole ref={pythonConsoleRef} height="40vh" />
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Object Select Modal */}
      <ObjectSelectModal
        ref={objectSelectModalRef}
        title="Select Object"
        searchObjectUrl={urls.searchNames}
        onSelectObject={handleObjectSelected}
      />
    </>
  );
}

export default DrillQuestionPage;
