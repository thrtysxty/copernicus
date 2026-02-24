export type AgentTarget = 'claude' | 'gemini' | 'jules' | 'chat' | 'all' | 'active';

export interface SlashCommand {
  name: string;
  target: AgentTarget;
  description: string;
  handler?: (args: string) => void;
}
