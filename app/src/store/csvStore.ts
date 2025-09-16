import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CsvData, CsvCell, CsvSelection, ViewportRange, FilterConfig, SortConfig } from '../types/csv';

interface CsvState {
  // Data state
  data: CsvData | null;
  currentFilePath: string | null;
  isLoading: boolean;
  error: string | null;

  // Selection state
  selectedCell: CsvCell | null;
  selectedRange: CsvSelection | null;

  // Viewport state
  viewportRange: ViewportRange;

  // Editing state
  editingCell: CsvCell | null;
  hasUnsavedChanges: boolean;

  // Clipboard state
  clipboard: string[][] | null;

  // Filter and sort state
  filters: FilterConfig[];
  sorts: SortConfig[];

  // Actions
  setData: (data: CsvData, filePath?: string) => void;
  setCurrentFilePath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  selectCell: (cell: CsvCell | null) => void;
  selectRange: (range: CsvSelection | null) => void;
  selectRow: (rowIndex: number) => void;
  selectColumn: (columnIndex: number) => void;
  selectAll: () => void;
  extendSelection: (cell: CsvCell) => void;

  setViewportRange: (range: ViewportRange) => void;

  startEditing: (cell: CsvCell) => void;
  stopEditing: () => void;
  updateCell: (cell: CsvCell, value: string) => void;

  addFilter: (filter: FilterConfig) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;

  addSort: (sort: SortConfig) => void;
  removeSort: (index: number) => void;
  clearSorts: () => void;

  // Clipboard actions
  copySelection: () => void;
  cutSelection: () => void;
  paste: (targetCell?: CsvCell) => void;
  deleteSelection: () => void;

  markSaved: () => void;
  reset: () => void;
}

export const useCsvStore = create<CsvState>()(
  devtools(
    (set, get) => ({
      // Initial state
      data: null,
      currentFilePath: null,
      isLoading: false,
      error: null,

      selectedCell: null,
      selectedRange: null,

      viewportRange: {
        startRow: 0,
        endRow: 50,
        startColumn: 0,
        endColumn: 10
      },

      editingCell: null,
      hasUnsavedChanges: false,

      clipboard: null,

      filters: [],
      sorts: [],

      // Actions
      setData: (data, filePath) => set({
        data,
        error: null,
        currentFilePath: filePath || get().currentFilePath
      }),
      setCurrentFilePath: (currentFilePath) => set({ currentFilePath }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),

      selectCell: (selectedCell) => set({ selectedCell, selectedRange: null }),
      selectRange: (selectedRange) => set({ selectedRange, selectedCell: null }),

      selectRow: (rowIndex) => {
        const state = get();
        if (!state.data) return;

        const selection: CsvSelection = {
          startRow: rowIndex,
          startColumn: 0,
          endRow: rowIndex,
          endColumn: state.data.headers.length - 1,
          type: 'row',
          anchorRow: rowIndex,
          anchorColumn: 0,
          focusRow: rowIndex,
          focusColumn: state.data.headers.length - 1
        };

        set({ selectedRange: selection, selectedCell: null });
      },

      selectColumn: (columnIndex) => {
        const state = get();
        if (!state.data) return;

        const selection: CsvSelection = {
          startRow: 0,
          startColumn: columnIndex,
          endRow: state.data.rows.length - 1,
          endColumn: columnIndex,
          type: 'column',
          anchorRow: 0,
          anchorColumn: columnIndex,
          focusRow: state.data.rows.length - 1,
          focusColumn: columnIndex
        };
        set({ selectedRange: selection, selectedCell: null });
      },

      selectAll: () => {
        const state = get();
        if (!state.data) return;

        const selection: CsvSelection = {
          startRow: 0,
          startColumn: 0,
          endRow: state.data.rows.length - 1,
          endColumn: state.data.headers.length - 1,
          type: 'range',
          anchorRow: 0,
          anchorColumn: 0,
          focusRow: state.data.rows.length - 1,
          focusColumn: state.data.headers.length - 1
        };

        set({ selectedRange: selection, selectedCell: null });
      },

      extendSelection: (cell) => {
        const state = get();

        // If there's a selected cell, create a range from that cell to the new cell
        if (state.selectedCell) {
          const newSelection: CsvSelection = {
            startRow: Math.min(state.selectedCell.row, cell.row),
            startColumn: Math.min(state.selectedCell.column, cell.column),
            endRow: Math.max(state.selectedCell.row, cell.row),
            endColumn: Math.max(state.selectedCell.column, cell.column),
            type: 'range',
            anchorRow: state.selectedCell.row,
            anchorColumn: state.selectedCell.column,
            focusRow: cell.row,
            focusColumn: cell.column
          };
          set({ selectedRange: newSelection, selectedCell: null });
        }
        // If there's already a selection, extend it from the anchor point
        else if (state.selectedRange) {
          const anchorRow = state.selectedRange.anchorRow ?? state.selectedRange.startRow;
          const anchorColumn = state.selectedRange.anchorColumn ?? state.selectedRange.startColumn;

          const newSelection: CsvSelection = {
            startRow: Math.min(anchorRow, cell.row),
            startColumn: Math.min(anchorColumn, cell.column),
            endRow: Math.max(anchorRow, cell.row),
            endColumn: Math.max(anchorColumn, cell.column),
            type: 'range',
            anchorRow,
            anchorColumn,
            focusRow: cell.row,
            focusColumn: cell.column
          };
          set({ selectedRange: newSelection, selectedCell: null });
        }
        // Otherwise, just select the cell
        else {
          set({ selectedCell: cell, selectedRange: null });
        }
      },

      setViewportRange: (viewportRange) => set({ viewportRange }),

      startEditing: (editingCell) => set({ editingCell }),
      stopEditing: () => set({ editingCell: null }),

      updateCell: (cell, value) => {
        const state = get();
        if (!state.data) return;

        const newRows = [...state.data.rows];
        if (newRows[cell.row]) {
          newRows[cell.row] = [...newRows[cell.row]];
          newRows[cell.row][cell.column] = value;
        }

        // Keep the cell selected after updating so navigation continues to work
        const updatedCell = { ...cell, value };

        set({
          data: {
            ...state.data,
            rows: newRows
          },
          hasUnsavedChanges: true,
          editingCell: null,
          selectedCell: updatedCell
        });
      },

      addFilter: (filter) => {
        const state = get();
        const existingIndex = state.filters.findIndex(f => f.column === filter.column);

        if (existingIndex >= 0) {
          const newFilters = [...state.filters];
          newFilters[existingIndex] = filter;
          set({ filters: newFilters });
        } else {
          set({ filters: [...state.filters, filter] });
        }
      },

      removeFilter: (index) => {
        const state = get();
        const newFilters = state.filters.filter((_, i) => i !== index);
        set({ filters: newFilters });
      },

      clearFilters: () => set({ filters: [] }),

      addSort: (sort) => {
        const state = get();
        const newSorts = state.sorts.filter(s => s.column !== sort.column);
        set({ sorts: [sort, ...newSorts] });
      },

      removeSort: (index) => {
        const state = get();
        const newSorts = state.sorts.filter((_, i) => i !== index);
        set({ sorts: newSorts });
      },

      clearSorts: () => set({ sorts: [] }),

      // Clipboard operations
      copySelection: () => {
        const state = get();
        if (!state.data) return;

        let cellsToClip: string[][] = [];

        if (state.selectedCell) {
          // Copy single cell
          cellsToClip = [[state.selectedCell.value]];
        } else if (state.selectedRange) {
          // Copy range selection
          for (let row = state.selectedRange.startRow; row <= state.selectedRange.endRow; row++) {
            const rowData: string[] = [];
            for (let col = state.selectedRange.startColumn; col <= state.selectedRange.endColumn; col++) {
              rowData.push(state.data.rows[row]?.[col] || '');
            }
            cellsToClip.push(rowData);
          }
        }

        if (cellsToClip.length > 0) {
          set({ clipboard: cellsToClip });
        }
      },

      cutSelection: () => {
        const state = get();
        // First copy the selection
        state.copySelection();
        // Then delete it
        state.deleteSelection();
      },

      paste: (targetCell) => {
        const state = get();
        if (!state.data || !state.clipboard) return;

        const newRows = [...state.data.rows];
        const target = targetCell || state.selectedCell;

        if (!target) return;

        const startRow = target.row;
        const startCol = target.column;

        // Paste clipboard data starting from target cell
        for (let clipRow = 0; clipRow < state.clipboard.length; clipRow++) {
          const targetRowIndex = startRow + clipRow;

          // Extend rows if necessary
          while (targetRowIndex >= newRows.length) {
            newRows.push(new Array(state.data.headers.length).fill(''));
          }

          for (let clipCol = 0; clipCol < state.clipboard[clipRow].length; clipCol++) {
            const targetColIndex = startCol + clipCol;

            // Only paste if within bounds
            if (targetColIndex < state.data.headers.length) {
              if (!newRows[targetRowIndex]) {
                newRows[targetRowIndex] = new Array(state.data.headers.length).fill('');
              }
              newRows[targetRowIndex][targetColIndex] = state.clipboard[clipRow][clipCol];
            }
          }
        }

        set({
          data: { ...state.data, rows: newRows },
          hasUnsavedChanges: true
        });
      },

      deleteSelection: () => {
        const state = get();
        if (!state.data) return;

        const newRows = [...state.data.rows];

        if (state.selectedCell) {
          // Delete single cell
          if (newRows[state.selectedCell.row]) {
            newRows[state.selectedCell.row] = [...newRows[state.selectedCell.row]];
            newRows[state.selectedCell.row][state.selectedCell.column] = '';
          }
        } else if (state.selectedRange) {
          // Delete range selection
          for (let row = state.selectedRange.startRow; row <= state.selectedRange.endRow; row++) {
            if (newRows[row]) {
              newRows[row] = [...newRows[row]];
              for (let col = state.selectedRange.startColumn; col <= state.selectedRange.endColumn; col++) {
                newRows[row][col] = '';
              }
            }
          }
        }

        set({
          data: { ...state.data, rows: newRows },
          hasUnsavedChanges: true
        });
      },

      markSaved: () => set({ hasUnsavedChanges: false }),

      reset: () => set({
        data: null,
        currentFilePath: null,
        isLoading: false,
        error: null,
        selectedCell: null,
        selectedRange: null,
        editingCell: null,
        hasUnsavedChanges: false,
        clipboard: null,
        filters: [],
        sorts: [],
        viewportRange: {
          startRow: 0,
          endRow: 50,
          startColumn: 0,
          endColumn: 10
        }
      })
    }),
    { name: 'csv-store' }
  )
);