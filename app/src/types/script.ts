// Script-related TypeScript types

export interface Script {
  id: string;
  content: string;
  scriptType: 'analysis' | 'transformation';
  generatedAt: string;
  userPrompt: string;
  executionState: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  executionResult?: ExecutionResult;
}

export interface ExecutionResult {
  executionId: string;
  startedAt: string;
  completedAt?: string;
  result: ResultPayload;
  error?: string;
}

export type ResultPayload =
  | { type: 'analysis'; summary: string; details: any }
  | { type: 'transformation'; changes: DataChange[]; preview: ChangePreview[] }
  | { type: 'error'; message: string };

export interface ExecutionProgress {
  executionId: string;
  processedRows: number;
  totalRows: number;
  currentStep: string;
  progressPercentage: number;
  estimatedRemainingSeconds?: number;
  startedAt: string;
  lastUpdated: string;
}

export interface DataChange {
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
}

export interface ChangePreview {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  oldValue: string;
  newValue: string;
}

