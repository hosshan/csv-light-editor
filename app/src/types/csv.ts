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
}

export interface ViewportRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface FilterConfig {
  column: number;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

export interface SortConfig {
  column: number;
  direction: 'asc' | 'desc';
}