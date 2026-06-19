export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspDiagnostic {
  range: LspRange;
  severity: number;
  message: string;
  source?: string;
}

export interface LspCompletionItem {
  label: string;
  kind?: number;
  insertText?: string;
  documentation?: string | { value: string };
}

export interface LspCompletionResponse {
  items: LspCompletionItem[];
}

export interface LspHoverResponse {
  contents: string | { value: string } | Array<{ value: string }>;
}

export interface AgentCodeStreamPayload {
  filePath: string;
  proposedDiff: string;
}

declare global {
  interface Window {
    _ui_export_jsx: () => Promise<void>;
    _ui_export_html: () => Promise<void>;
  }
}
