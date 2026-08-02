export type AIMessageRole =
  | 'user'
  | 'assistant'
  | 'system';

export type AIMessage = {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: string;
};

export type AIQuickAction = {
  id: string;
  label: string;
  prompt: string;
  description: string;
};
