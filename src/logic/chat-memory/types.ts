export type Role = 'user' | 'assistant' | 'system' | 'model';

export interface ChatMessage {
  role: Role;
  content: string;
  ts: number;
  source?: any[];
  attachments?: any[];
  id?: string;
  type?: string;
}

export interface ConversationState {
  conversationId: string;
  summary?: string;        // optional rolling summary
  messages: ChatMessage[]; // recent N turns
}

export interface PolicySection {
  id: string;           // sectionId ("3.2")
  title: string;
  parent_id: string | null;
  level: number;
  exact_text: string;   // VERBATIM text
  sha256: string;
}
export interface Policy {
  document_id: string;
  version: string;
  sections: PolicySection[];
}