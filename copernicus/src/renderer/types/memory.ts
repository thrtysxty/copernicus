export interface MemoryRow {
  id: string;
  projectId: string;
  bankId: string;
  eventType: string;
  content: string;
  importance: number;
  tags?: string[];
  entities?: string[];
  meta?: any;
  supersedesId?: string;
  ts: number;
  score: number;
}

export interface WorkLogRow {
  id: string;
  projectId: string;
  bankId: string;
  eventType: string;
  meta: any;
  ts: number;
}
