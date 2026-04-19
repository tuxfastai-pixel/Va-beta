export type AgentResult<T = unknown> = {
  success: boolean;
  data?: T;
  confidence: number;
  feedback?: string;
};
