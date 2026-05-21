import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ChatBotShell } from "./ChatBotShell";
import { ChatBotHeader } from "./ChatBotHeader";
import { ModeChips } from "./ModeChips";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { loadUiState, saveUiState } from "./storage";
import { flattenSegmentsToText, streamDjangoReply } from "./streamDjangoReply";
import type { ChatMessage, ChatMode, DjangoSegment } from "./types";
import { getCsrfToken } from "../utils/reactUtils";

interface ChatBotProps {
  blobUuid?: string;
  chatUrl: string;
  followupsUrl: string;
  djangoChatUrl?: string;
}

export interface ChatBotHandle {
  show: boolean;
}

const SYSTEM_MESSAGE: ChatMessage = {
  id: 1,
  content: "You are a helpful assistant.",
  role: "system",
};

export const ChatBot = forwardRef<ChatBotHandle, ChatBotProps>(function ChatBot(
  { blobUuid = "", chatUrl, followupsUrl, djangoChatUrl = "" },
  ref
) {
  const initialUi = loadUiState();
  const [show, setShow] = useState(false);
  const [pinned, setPinned] = useState(initialUi.pinned);
  const [pinnedWidth, setPinnedWidth] = useState(initialUi.pinnedWidth);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [history, setHistory] = useState<ChatMessage[]>([SYSTEM_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useImperativeHandle(ref, () => ({ show }));

  // Persist pin state on change.
  useEffect(() => {
    saveUiState({ pinned, pinnedWidth });
  }, [pinned, pinnedWidth]);

  const closeChat = useCallback(() => {
    setShow(false);
    abortRef.current?.abort();
  }, []);

  const togglePin = useCallback(() => {
    setPinned(p => !p);
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      opts: { questionUuid?: string; exerciseUuid?: string; baseHistory?: ChatMessage[] } = {}
    ) => {
      const startingHistory = opts.baseHistory ?? history;
      let payload: Record<string, string> = {};
      let nextHistory = startingHistory;
      let nextMode = mode;

      const isDjango = mode === "django" && !opts.questionUuid && !opts.exerciseUuid;

      if (opts.questionUuid) {
        nextHistory = [SYSTEM_MESSAGE];
        nextMode = "question";
        payload = { question_uuid: opts.questionUuid };
      } else if (opts.exerciseUuid) {
        nextHistory = [SYSTEM_MESSAGE];
        nextMode = "exercise";
        payload = { exercise_uuid: opts.exerciseUuid };
      } else if (mode === "blob") {
        nextHistory = [SYSTEM_MESSAGE];
        payload = { content, blob_uuid: blobUuid };
      } else if (isDjango) {
        const userMsg: ChatMessage = {
          id: startingHistory.length + 1,
          content,
          role: "user",
        };
        nextHistory = [...startingHistory, userMsg];
      } else {
        const userMsg: ChatMessage = {
          id: startingHistory.length + 1,
          content,
          role: "user",
        };
        nextHistory = [...startingHistory, userMsg];
        payload = {
          chat_history: JSON.stringify(nextHistory),
          mode,
        };
      }

      setMode(nextMode);
      setHistory(nextHistory);
      setDraft("");
      setFollowups([]);
      setIsStreaming(true);

      const assistantMsg: ChatMessage = {
        id: nextHistory.length + 1,
        content: "",
        role: "assistant",
        ...(isDjango ? { segments: [] } : {}),
      };
      setHistory(prev => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let assembledReply = "";

        if (isDjango) {
          await streamDjangoReply({
            url: djangoChatUrl,
            userText: content,
            signal: controller.signal,
            updateAssistant: mutate => {
              setHistory(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  const nextSegments = mutate(last.segments ?? []);
                  updated[updated.length - 1] = {
                    ...last,
                    segments: nextSegments,
                    content: nextSegments
                      .filter(
                        (s): s is Extract<DjangoSegment, { kind: "text" }> => s.kind === "text"
                      )
                      .map(s => s.text)
                      .join(""),
                  };
                }
                return updated;
              });
            },
          });
          // Compute the final assembled text from segments for follow-ups.
          setHistory(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              assembledReply = flattenSegmentsToText(last);
            }
            return prev;
          });
        } else {
          const formData = new FormData();
          Object.entries(payload).forEach(([k, v]) => formData.append(k, v));
          const resp = await fetch(chatUrl, {
            method: "POST",
            headers: { "X-Csrftoken": getCsrfToken() },
            body: formData,
            signal: controller.signal,
          });
          if (!resp.ok) throw new Error("network");
          const reader = resp.body?.getReader();
          if (!reader) throw new Error("no body");
          const decoder = new TextDecoder("utf-8");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            assembledReply += chunk;
            setHistory(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") last.content += chunk;
              return updated;
            });
          }
        }

        // Fetch follow-ups (non-blocking — fire-and-forget).
        if (assembledReply.trim().length > 0) {
          fetch(followupsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Csrftoken": getCsrfToken(),
            },
            body: JSON.stringify({ assistant_reply: assembledReply, mode: nextMode }),
          })
            .then(r => r.json())
            .then(data => setFollowups((data as { suggestions?: string[] }).suggestions || []))
            .catch(() => setFollowups([]));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("chat error:", err);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [history, mode, blobUuid, chatUrl, followupsUrl, djangoChatUrl]
  );

  // Listen to EventBus for Alt-C and external triggers.
  useEffect(() => {
    if (!(window as any).EventBus) return;
    const bus = (window as any).EventBus;
    const handler = (payload: {
      content?: string;
      questionUuid?: string;
      exerciseUuid?: string;
    }) => {
      // Pure toggle if no payload (Alt-C with no extras).
      if (!payload.content && !payload.questionUuid && !payload.exerciseUuid) {
        setShow(s => !s);
        return;
      }
      setShow(true);
      sendMessage(payload.content || "", payload);
    };
    bus.$on("chat", handler);
    return () => bus.$off("chat", handler);
  }, [sendMessage]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
  }, [draft, isStreaming, sendMessage]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleEscape = useCallback(() => {
    if (pinned) {
      // Esc unfocuses only — leave the dock open.
      (document.activeElement as HTMLElement | null)?.blur();
    } else {
      closeChat();
    }
  }, [pinned, closeChat]);

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    const trimmed = history.filter(
      (m, i, arr) => !(i === arr.length - 1 && m.role === "assistant")
    );
    const visible = trimmed.filter(m => m.role !== "system");
    const lastUser = [...visible].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content, { baseHistory: trimmed });
  }, [history, isStreaming, sendMessage]);

  if (!show) return null;

  return (
    <ChatBotShell
      pinned={pinned}
      pinnedWidth={pinnedWidth}
      onPinnedWidthChange={setPinnedWidth}
      onClose={closeChat}
    >
      <ChatBotHeader pinned={pinned} onClose={closeChat} onTogglePin={togglePin} />
      <ModeChips
        mode={mode}
        hasBlobContext={!!blobUuid}
        showDjango={!!djangoChatUrl}
        onChange={setMode}
      />
      <MessageList
        messages={history}
        isStreaming={isStreaming}
        followups={followups}
        onRegenerate={handleRegenerate}
        onSelectFollowUp={text => sendMessage(text)}
      />
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={handleStop}
        onEscape={handleEscape}
        isStreaming={isStreaming}
        autoFocus
      />
    </ChatBotShell>
  );
});

export default ChatBot;
