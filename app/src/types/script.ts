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
  retryCount?: number;
}

export type ResultPayload =
  | { type: 'analysis'; summary: string; details: any }
  | {
      type: 'transformation';
      changes?: DataChange[];  // Legacy format
      unifiedChanges?: Change[];  // New unified format
      preview: ChangePreview[];
    }
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

// Legacy format - kept for backward compatibility
export interface DataChange {
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
}

// Unified change structure that supports all types of operations
export type Change =
  | CellChange
  | AddColumnChange
  | RemoveColumnChange
  | RenameColumnChange
  | AddRowChange
  | RemoveRowChange;

export interface CellChange {
  type: 'cell';
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
}

export interface AddColumnChange {
  type: 'add_column';
  columnIndex: number;  // Insert position
  columnName: string;
  position: 'before' | 'after';  // Relative to columnIndex
  defaultValue?: string;  // Default value for existing rows
}

export interface RemoveColumnChange {
  type: 'remove_column';
  columnIndex: number;
  columnName: string;
}

export interface RenameColumnChange {
  type: 'rename_column';
  columnIndex: number;
  oldName: string;
  newName: string;
}

export interface AddRowChange {
  type: 'add_row';
  rowIndex: number;  // Insert position
  position: 'before' | 'after';  // Relative to rowIndex
  rowData?: string[];  // Row data (if not provided, empty row)
}

export interface RemoveRowChange {
  type: 'remove_row';
  rowIndex: number;
}

export interface ChangePreview {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  oldValue: string;
  newValue: string;
}

