export interface Story {
  id: string;
  title: string;
  status: string;
  path: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN';
  type: string;
  epic: string | null;
  model: string | null;
  workflowId: string | null;
  date: string;
  blocked: boolean;
  flagged?: boolean;
}
