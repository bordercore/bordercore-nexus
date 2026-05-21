export type ChatRole = "system" | "user" | "assistant";

export type DjangoSegment =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; output?: string }
  | { kind: "error"; message: string };

export interface ChatMessage {
  id: number;
  content: string;
  role: ChatRole;
  // Present only on assistant messages produced in `django` mode.
  // When set, MessageList renders segments (text + tool calls) instead of `content`.
  segments?: DjangoSegment[];
}

export type ChatMode = "chat" | "notes" | "blob" | "question" | "exercise" | "django";

export interface ChatBotPersistedUI {
  pinned: boolean;
  pinnedWidth: number;
}
