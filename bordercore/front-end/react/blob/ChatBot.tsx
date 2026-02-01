import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import MarkdownIt from "markdown-it";

// Initialize markdown-it renderer
const markdown = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface ChatMessage {
  id: number;
  content: string;
  role: "system" | "user" | "assistant";
}

interface ChatBotProps {
  blobUuid?: string;
  chatUrl: string;
  csrfToken: string;
}

export interface ChatBotHandle {
  show: boolean;
}

export const ChatBot = forwardRef<ChatBotHandle, ChatBotProps>(function ChatBot(
  { blobUuid = "", chatUrl, csrfToken },
  ref
) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 1,
      content: "You are a helpful assistant.",
      role: "system",
    },
  ]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [mode, setMode] = useState("chat");
  const [prompt, setPrompt] = useState("");
  const [show, setShow] = useState(false);

  useImperativeHandle(ref, () => ({
    show: show,
  }));

  const chatOptions = [
    { name: "Query Notes", value: "notes" },
    { name: "Chat", value: "chat" },
    ...(blobUuid ? [{ name: "Query Blob", value: "blob" }] : []),
  ];

  const filteredChatHistory = chatHistory.filter(x => x.role !== "system");

  const getMarkdown = (content: string) => {
    return markdown.render(content);
  };

  const handleChat = async (content?: string, questionUuid?: string, exerciseUuid?: string) => {
    let id: number | null = null;
    let payload: Record<string, string> = {};

    if (questionUuid) {
      setChatHistory([]);
      id = 1;
      setPrompt("");
      payload = { question_uuid: questionUuid };
      setMode("chat");
    } else if (exerciseUuid) {
      setChatHistory([]);
      id = 1;
      setPrompt("");
      payload = { exercise_uuid: exerciseUuid };
      setMode("chat");
    } else if (mode === "chat" || mode === "notes") {
      const newMessage: ChatMessage = {
        id: chatHistory.length + 1,
        content: content || prompt,
        role: "user",
      };
      setChatHistory(prev => [...prev, newMessage]);
      setPrompt("");
      id = chatHistory.length + 2;
      payload = {
        chat_history: JSON.stringify([...chatHistory, newMessage]),
        mode: mode,
      };
    } else if (mode === "blob") {
      if (prompt === "") {
        return;
      }
      setChatHistory([]);
      id = 1;
      const chatContent = prompt;
      setPrompt("");
      payload = {
        content: chatContent,
        blob_uuid: blobUuid,
      };
    }

    setIsWaiting(true);

    const formData = new FormData();
    for (const key in payload) {
      if (payload.hasOwnProperty(key)) {
        formData.append(key, payload[key]);
      }
    }

    try {
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "X-Csrftoken": csrfToken,
          Responsetype: "stream",
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder("utf-8");

      const assistantMessage: ChatMessage = {
        id: id || 1,
        content: "",
        role: "assistant",
      };
      setChatHistory(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        setIsWaiting(false);
        const newContent = decoder.decode(value, { stream: true });
        setChatHistory(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            lastMessage.content += newContent;
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    if (window.EventBus) {
      const handler = (payload: {
        content?: string;
        questionUuid?: string;
        exerciseUuid?: string;
      }) => {
        setShow(true);
        handleChat(payload.content, payload.questionUuid, payload.exerciseUuid);
      };
      window.EventBus.$on("chat", handler);

      return () => {
        window.EventBus.$off("chat", handler);
      };
    }
  }, []);

  useEffect(() => {
    if ((window as any).hotkeys) {
      const hotkeys = (window as any).hotkeys;
      hotkeys.filter = function (event: KeyboardEvent) {
        return true;
      };

      const handler = (event: KeyboardEvent, handler: any) => {
        const index = chatOptions.findIndex(obj => obj.value === mode);
        switch (handler.key) {
          case "down":
            if (index + 1 === chatOptions.length) {
              setMode(chatOptions[0].value);
            } else {
              setMode(chatOptions[index + 1].value);
            }
            break;
          case "up":
            if (index === 0) {
              setMode(chatOptions[chatOptions.length - 1].value);
            } else {
              setMode(chatOptions[index - 1].value);
            }
            break;
        }
      };

      hotkeys("down,up", handler);

      return () => {
        hotkeys.unbind("down,up");
      };
    }
  }, [mode, chatOptions]);

  if (!show) {
    return null;
  }

  const handleClose = () => {
    setShow(false);
  };

  // Render #chatbot directly - it has position:fixed in CSS so it overlays at bottom
  // The outer wrapper div was causing layout issues by being in document flow
  return (
    <div id="chatbot" className="d-flex flex-column align-items-center px-3">
      <div className="chatbot-container w-75 p-3 position-relative">
        <button
          type="button"
          className="btn-close chatbot-close-btn"
          aria-label="Close"
          onClick={handleClose}
        />
        <div className="chatbot-messages d-flex flex-column-reverse mb-3">
          <div>
            {filteredChatHistory.map(message => (
              <div key={message.id} className={`chatbot-${message.role} d-flex px-3 mb-2`}>
                <div className="fw-bold me-2">{message.role === "user" ? "You" : "AI"}</div>
                {/* Content is from AI responses and user's own messages, rendered with markdown-it */}
                <div dangerouslySetInnerHTML={{ __html: getMarkdown(message.content) }} />
              </div>
            ))}
            {isWaiting && <div className="chatbot-waiting ms-3">Waiting...</div>}
          </div>
        </div>
        <div className="d-flex">
          <input
            type="text"
            className="form-control me-2"
            placeholder="Send a message"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleChat();
              }
            }}
          />
          <select
            className="chatbot-mode form-control me-2"
            value={mode}
            onChange={e => setMode(e.target.value)}
          >
            {chatOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

export default ChatBot;
