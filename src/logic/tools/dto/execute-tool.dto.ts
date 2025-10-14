export enum ToolActionType {
  TRANSCRIBE_AUDIO = 'TRANSCRIBE_AUDIO',
  SUMMARIZE_CONVERSATION = 'SUMMARIZE_CONVERSATION',
  POLICY_AUDIT = 'POLICY_AUDIT',
  CREATE_JIRA = 'CREATE_JIRA',
  BROWSE_POLICIES = 'BROWSE_POLICIES',
}

export interface ExecuteToolDto {
  tool: ToolActionType;
  conversationId?: string;
  input?: string;
  fileIds?: string[];
}
