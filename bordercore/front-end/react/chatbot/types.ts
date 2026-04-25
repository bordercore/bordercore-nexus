export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: number;
  content: string;
  role: ChatRole;
}

export type ChatMode = "chat" | "notes" | "blob" | "question" | "exercise";

export interface ChatBotPersistedUI {
  pinned: boolean;
  pinnedWidth: number;
}
