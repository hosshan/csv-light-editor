export interface CsvData {
  headers: string[];
  rows: string[][];
  metadata: CsvMetadata;
}

export interface CsvMetadata {
  filename: string;
  path: string;
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
  delimiter: string;
  encoding: string;
  fileSize: number;
  lastModified: string;
}

export interface CsvCell {
  row: number;
  column: number;
  value: string;
}

export interface CsvSelection {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  type: 'cell' | 'row' | 'column' | 'range';
  anchorRow?: number;
  anchorColumn?: number;
  focusRow?: number;
  focusColumn?: number;
}

export interface ViewportRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface FilterConfig {
  id: string;
  column: number;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty' |
           'greater' | 'less' | 'greaterOrEqual' | 'lessOrEqual' | 'between' |
           'dateAfter' | 'dateBefore' | 'dateRange' | 'regex';
  value: string;
  value2?: string; // For 'between' and 'dateRange' operators
  dataType?: 'text' | 'number' | 'date';
  isActive: boolean;
}

export interface SortConfig {
  column: number;
  direction: 'asc' | 'desc';
}

export type SortDirection = 'Ascending' | 'Descending';

export interface SortColumn {
  column_index: number;
  direction: SortDirection;
}

export interface SortState {
  columns: SortColumn[];
}

export interface HistoryAction {
  type: 'cell_update' | 'range_update' | 'paste' | 'delete' | 'cut' |
        'add_row' | 'delete_row' | 'duplicate_row' |
        'add_column' | 'delete_column' | 'rename_column' |
        'replace_all' | 'replace_current';
  data: {
    beforeData: CsvData;
    afterData: CsvData;
    selection?: CsvCell | CsvSelection;
    description?: string;
  };
  timestamp: number;
}