import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import hotkeys from "hotkeys-js";
import MarkdownIt from "markdown-it";
import Prism from "prismjs";

(globalThis as any).Prism = Prism;

const prismLanguagesLoaded = Promise.all([
  import("prismjs/components/prism-python"),
  import("prismjs/components/prism-bash"),
  import("prismjs/components/prism-sql"),
  import("prismjs/components/prism-json"),
  import("prismjs/components/prism-yaml"),
  import("prismjs/components/prism-go"),
  import("prismjs/components/prism-rust"),
  import("prismjs/components/prism-java"),
  import("prismjs/components/prism-typescript"),
  import("prismjs/components/prism-c"),
  import("prismjs/components/prism-cpp"),
  import("prismjs/components/prism-ruby"),
  import("prismjs/components/prism-markdown"),
]);

import ObjectSelectModal from "../common/ObjectSelectModal";
import { PythonConsole, PythonConsoleHandle } from "../common/PythonConsole";
import { RelatedObjectsHandle } from "../common/RelatedObjects";
import { doPost, EventBus } from "../utils/reactUtils";

import DrillTopbar from "./components/DrillTopbar";
import ReviewStatePanel from "./components/ReviewStatePanel";
import RelatedObjectsPanel from "./components/RelatedObjectsPanel";
import TagProgressPanel from "./components/TagProgressPanel";
import QuestionCard from "./components/QuestionCard";
import { RatingKey } from "./components/RatingBar";

// Languages we tag-fence-fallback to when a code block is unlabeled.
// Must be a subset of: Prism core (javascript, css, markup, clike) +
// languages dynamically imported above into prismLanguagesLoaded.
const KNOWN_PRISM_LANGS = new Set([
  "javascript",
  "python",
  "bash",
  "sql",
  "json",
  "yaml",
  "go",
  "rust",
  "java",
  "typescript",
  "c",
  "cpp",
  "ruby",
  "markdown",
]);

function escapeHtmlForCode(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface TagInfo {
  name: string;
  count: number;
  progress: number;
  last_reviewed: string;
  url: string;
}

interface IntervalEntry {
  description: string;
  days: number;
  interval_index: number;
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
    intervalIndex: number;
    intervalCount: number;
    timesFailed: number;
    created: string;
    needsReview: boolean;
    isFavorite: boolean;
    isDisabled: boolean;
    isReversible: boolean;
    tags: { name: string }[];
  };
  lastResponse: string | null;
  tagInfo: TagInfo[];
  intervals: Record<string, IntervalEntry>;
  reverseQuestion: boolean;
  studySessionProgress: number;
  studySession: StudySession | null;
  sqlDb: { blob: { uuid: string } } | null;
  urls: {
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
    sqlPlayground: string;
    startStudySession: string;
  };
  currentPath: string;
}

const RECORD_URL_BY_RATING: Record<RatingKey, keyof DrillQuestionPageProps["urls"]> = {
  easy: "recordResponseEasy",
  good: "recordResponseGood",
  hard: "recordResponseHard",
  reset: "recordResponseReset",
};

export function DrillQuestionPage({
  question,
  lastResponse,
  tagInfo,
  intervals,
  reverseQuestion,
  studySessionProgress,
  studySession,
  sqlDb,
  urls,
  currentPath,
}: DrillQuestionPageProps) {
  const [revealed, setRevealed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(question.isFavorite);

  const relatedObjectsRef = useRef<RelatedObjectsHandle>(null);
  const [objectSelectOpen, setObjectSelectOpen] = useState(false);

  const [showPythonConsole, setShowPythonConsole] = useState(false);
  const pythonConsoleRef = useRef<PythonConsoleHandle>(null);

  // Markdown of the user's own questions / answers. When a fenced code
  // block has no language tag, fall back to a Prism language inferred
  // from the question's own tags so untagged fences still get colored.
  const md = useMemo(() => {
    const inferredLang =
      question.tags.map(t => t.name.toLowerCase()).find(name => KNOWN_PRISM_LANGS.has(name)) ??
      null;
    return new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: (str: string, lang: string): string => {
        if (lang) return ""; // MarkdownIt's default already adds language-<lang>
        if (!inferredLang) return "";
        const code = escapeHtmlForCode(str);
        return (
          `<pre class="language-${inferredLang}">` +
          `<code class="language-${inferredLang}">${code}</code></pre>\n`
        );
      },
    });
  }, [question.tags]);

  const renderedQuestion = useMemo(() => md.render(question.question), [md, question.question]);
  const renderedAnswer = useMemo(() => md.render(question.answer), [md, question.answer]);

  const questionHtml = reverseQuestion ? renderedAnswer : renderedQuestion;
  const answerHtml = reverseQuestion ? renderedQuestion : renderedAnswer;

  const handleReveal = useCallback(() => {
    setRevealed(true);
    // Defer Prism + MathJax until React commits the revealed content;
    // both are DOM-walk operations and need the new HTML on the page.
    setTimeout(() => {
      prismLanguagesLoaded.then(() => Prism.highlightAll());
      if (typeof (window as any).MathJax?.typeset === "function") {
        (window as any).MathJax.typeset();
      }
    }, 10);
  }, []);

  // Functional updater so toggle doesn't re-create the callback (which would
  // rebind all hotkeys via the effect below). Note: in React strict mode the
  // updater fires twice in dev, causing two POSTs. The favorite mutation is
  // idempotent on the server, so the duplicate is harmless.
  const handleFavoriteToggle = useCallback(() => {
    setIsFavorite(prev => {
      const next = !prev;
      doPost(
        urls.isFavoriteMutate,
        { question_uuid: question.uuid, mutation: next ? "add" : "delete" },
        () => {}
      );
      return next;
    });
  }, [question.uuid, urls.isFavoriteMutate]);

  const handleAskChatbot = useCallback(() => {
    EventBus.$emit("chat", { questionUuid: question.uuid });
  }, [question.uuid]);

  const handleOpenObjectSelectModal = useCallback(() => {
    setObjectSelectOpen(true);
  }, []);

  // Mounting <PythonConsole> auto-loads Pyodide via its own effect; we just
  // flip the flag once and leave it mounted so subsequent clicks scroll back
  // to it instead of paying the load cost again.
  const handleOpenPythonConsole = useCallback(() => {
    setShowPythonConsole(true);
  }, []);

  const handleObjectSelected = useCallback(
    (selectedObject: { uuid: string; name: string }) => {
      doPost(
        urls.newObject,
        { node_uuid: question.uuid, object_uuid: selectedObject.uuid, node_type: "drill" },
        () => relatedObjectsRef.current?.refresh()
      );
    },
    [urls.newObject, question.uuid]
  );

  const handleRate = useCallback(
    (key: RatingKey) => {
      const url = urls[RECORD_URL_BY_RATING[key]];
      doPost(url, {}, (response: any) => {
        if (response.data?.redirect_url) {
          window.location.href = response.data.redirect_url;
        }
      });
    },
    [urls]
  );

  const handleSkip = useCallback(() => {
    window.location.href = urls.drillStudy;
  }, [urls.drillStudy]);

  const editUrl = `${urls.drillUpdate}?return_url=${encodeURIComponent(currentPath)}`;

  // Hotkeys: space reveal, 1-4 rate, s skip, f favorite
  useEffect(() => {
    hotkeys.filter = () => true;

    const handler = (event: KeyboardEvent, h: any) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      switch (h.key) {
        case "space":
          if (!revealed) {
            event.preventDefault();
            handleReveal();
          }
          break;
        case "1":
          if (revealed) handleRate("easy");
          break;
        case "2":
          if (revealed) handleRate("good");
          break;
        case "3":
          if (revealed) handleRate("hard");
          break;
        case "4":
          if (revealed) handleRate("reset");
          break;
        case "s":
          handleSkip();
          break;
        case "f":
          handleFavoriteToggle();
          break;
      }
    };

    hotkeys("space,1,2,3,4,s,f", handler);
    return () => hotkeys.unbind("space,1,2,3,4,s,f");
  }, [revealed, handleReveal, handleRate, handleSkip, handleFavoriteToggle]);

  // Initial Prism + MathJax for the question prompt
  useEffect(() => {
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
    if (typeof (window as any).MathJax?.typeset === "function") {
      (window as any).MathJax.typeset();
    }
    prismLanguagesLoaded.then(() => Prism.highlightAll());
  }, []);

  const addQuestionUrl = question.tags.length > 0 ? urls.drillAddWithTag : urls.drillAdd;
  const sqlPlaygroundUrl = sqlDb ? `${urls.sqlPlayground}?sql_db_uuid=${sqlDb.blob.uuid}` : null;

  return (
    <div className="drill-detail-app">
      <div className="scanlines" aria-hidden="true" />

      <DrillTopbar
        isFavorite={isFavorite}
        onFavoriteToggle={handleFavoriteToggle}
        onAskChatbot={handleAskChatbot}
        onOpenObjectSelectModal={handleOpenObjectSelectModal}
        onOpenPythonConsole={handleOpenPythonConsole}
        addQuestionUrl={addQuestionUrl}
        editUrl={editUrl}
        studySession={studySession}
        studySessionProgress={studySessionProgress}
      />

      <div className="drill-shell">
        <aside>
          <ReviewStatePanel
            lastReviewed={question.lastReviewed}
            lastResponse={lastResponse}
            intervalDays={question.interval}
            intervalIndex={question.intervalIndex}
            intervalCount={question.intervalCount}
            timesFailed={question.timesFailed}
            needsReview={question.needsReview}
            created={question.created}
          />
          <RelatedObjectsPanel
            ref={relatedObjectsRef}
            objectUuid={question.uuid}
            relatedObjectsUrl={urls.relatedObjects}
            newObjectUrl={urls.newObject}
            removeObjectUrl={urls.removeObject}
            sortRelatedObjectsUrl={urls.sortRelatedObjects}
            editRelatedObjectNoteUrl={urls.editRelatedObjectNote}
            searchNamesUrl={urls.searchNames}
            onOpenObjectSelectModal={handleOpenObjectSelectModal}
          />
          <TagProgressPanel tags={tagInfo} />
        </aside>

        <div className="drill-main">
          <QuestionCard
            uuid={question.uuid}
            questionHtml={questionHtml}
            answerHtml={answerHtml}
            tags={question.tags}
            needsReview={question.needsReview}
            isDisabled={question.isDisabled}
            intervals={intervals}
            currentIntervalDays={question.interval}
            currentIntervalIndex={question.intervalIndex}
            revealed={revealed}
            onReveal={handleReveal}
            onRate={handleRate}
            onSkip={handleSkip}
            sqlPlaygroundUrl={sqlPlaygroundUrl}
            startStudySessionUrl={urls.startStudySession}
          />
          {showPythonConsole && <PythonConsole ref={pythonConsoleRef} height="40vh" />}
        </div>
      </div>

      <ObjectSelectModal
        open={objectSelectOpen}
        onClose={() => setObjectSelectOpen(false)}
        title="Select object"
        searchObjectUrl={urls.searchNames}
        onSelectObject={handleObjectSelected}
      />
    </div>
  );
}

export default DrillQuestionPage;
