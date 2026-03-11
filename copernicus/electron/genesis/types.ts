export interface GenesisPayload {
  idea: string;
  audience: string;
  coreValue: string;
  projectName: string;
  stack: string;
  repoPath: string;
  isNewRepo: boolean;
}

export interface SynthesisResult {
  epic: { title: string; description: string };
  stories: { title: string; priority: 'P1' | 'P2' | 'P3'; ac: string }[];
}
