import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CsvData, CsvCell, CsvSelection, ViewportRange, FilterConfig, SortConfig, HistoryAction, SortState } from '../types/csv';

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

  // Column width state
  columnWidths: Record<number, number>;
  defaultColumnWidth: number;

  // Editing state
  editingCell: CsvCell | null;
  hasUnsavedChanges: boolean;

  // Clipboard state
  clipboard: string[][] | null;

  // Filter and sort state
  filters: FilterConfig[];
  sorts: SortConfig[];
  currentSort: SortState;

  // History state for Undo/Redo
  history: HistoryAction[];
  historyIndex: number;

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

  // New sort functionality
  applySorting: (sortState: SortState) => void;
  clearSorting: () => void;

  // Row and column reordering
  moveRow: (fromIndex: number, toIndex: number) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;

  // Clipboard actions
  copySelection: () => void;
  cutSelection: () => void;
  paste: (targetCell?: CsvCell) => void;
  deleteSelection: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  addToHistory: (action: HistoryAction) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Row operations with history
  addRow: (position: 'above' | 'below', rowIndex: number) => void;
  deleteRow: (rowIndex: number) => void;
  duplicateRow: (rowIndex: number) => void;

  // Column operations with history
  addColumn: (position: 'before' | 'after', columnIndex: number) => void;
  deleteColumn: (columnIndex: number) => void;
  renameColumn: (columnIndex: number, newName: string) => void;

  // Batch operations with history
  replaceAll: (newData: CsvData, description?: string) => void;

  // Column width operations
  setColumnWidth: (columnIndex: number, width: number) => void;
  getColumnWidth: (columnIndex: number) => number;
  resetColumnWidths: () => void;

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

      columnWidths: {},
      defaultColumnWidth: 150,

      editingCell: null,
      hasUnsavedChanges: false,

      clipboard: null,

      filters: [],
      sorts: [],
      currentSort: { columns: [] },

      history: [],
      historyIndex: -1,

      // Actions
      setData: async (data, filePath) => {
        const newFilePath = filePath || get().currentFilePath;
        set({
          data,
          error: null,
          currentFilePath: newFilePath
        });

        // Load sort state from metadata if file path is available
        if (newFilePath) {
          try {
            const { tauriAPI } = await import('../hooks/useTauri');
            const savedSortState = await tauriAPI.loadSortState(newFilePath);
            if (savedSortState && savedSortState.columns.length > 0) {
              set({ currentSort: savedSortState });
            }
          } catch (error) {
            console.warn('Failed to load sort state from metadata:', error);
          }
        }
      },
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

        // Store before state for history - deep copy rows
        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        const newRows = [...state.data.rows];
        if (newRows[cell.row]) {
          newRows[cell.row] = [...newRows[cell.row]];
          newRows[cell.row][cell.column] = value;
        }

        const afterData = {
          ...state.data,
          rows: newRows
        };

        // Add to history
        const historyAction: HistoryAction = {
          type: 'cell_update',
          data: {
            beforeData,
            afterData,
            selection: cell
          },
          timestamp: Date.now()
        };

        // Keep the cell selected after updating so navigation continues to work
        const updatedCell = { ...cell, value };

        set({
          data: afterData,
          hasUnsavedChanges: true,
          editingCell: null,
          selectedCell: updatedCell
        });

        // Add to history after state update
        get().addToHistory(historyAction);
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

      // New sort functionality with history support
      applySorting: async (sortState: SortState) => {
        const state = get();
        if (!state.data || !state.currentFilePath) return;

        try {
          // Import tauriAPI here to avoid circular dependencies
          const { tauriAPI } = await import('../hooks/useTauri');

          const beforeData = {
            ...state.data,
            rows: state.data.rows.map(row => [...row])
          };

          const sortedData = await tauriAPI.sortCsvData(state.data, sortState);

          const historyAction: HistoryAction = {
            type: 'replace_all',
            data: {
              beforeData,
              afterData: sortedData,
              description: `Sort by ${sortState.columns.length} column${sortState.columns.length > 1 ? 's' : ''}`
            },
            timestamp: Date.now()
          };

          set({
            data: sortedData,
            currentSort: sortState,
            hasUnsavedChanges: true
          });

          get().addToHistory(historyAction);

          // Save sort state to metadata
          try {
            await tauriAPI.saveSortState(state.currentFilePath, sortState);
          } catch (error) {
            console.warn('Failed to save sort state to metadata:', error);
          }
        } catch (error) {
          console.error('Failed to apply sorting:', error);
          set({ error: 'Failed to apply sorting' });
        }
      },

      clearSorting: async () => {
        const state = get();
        const emptySortState = { columns: [] };

        set({ currentSort: emptySortState });

        // Save empty sort state to metadata
        if (state.currentFilePath) {
          try {
            const { tauriAPI } = await import('../hooks/useTauri');
            await tauriAPI.saveSortState(state.currentFilePath, emptySortState);
          } catch (error) {
            console.warn('Failed to save empty sort state to metadata:', error);
          }
        }
      },

      // Row and column reordering with history support
      moveRow: async (fromIndex: number, toIndex: number) => {
        const state = get();
        if (!state.data) return;

        try {
          const { tauriAPI } = await import('../hooks/useTauri');

          const beforeData = {
            ...state.data,
            rows: state.data.rows.map(row => [...row])
          };

          const newData = await tauriAPI.moveRow(state.data, fromIndex, toIndex);

          const historyAction: HistoryAction = {
            type: 'replace_all',
            data: {
              beforeData,
              afterData: newData,
              description: `Move row from position ${fromIndex + 1} to ${toIndex + 1}`
            },
            timestamp: Date.now()
          };

          set({
            data: newData,
            hasUnsavedChanges: true
          });

          get().addToHistory(historyAction);
        } catch (error) {
          console.error('Failed to move row:', error);
          set({ error: 'Failed to move row' });
        }
      },

      moveColumn: async (fromIndex: number, toIndex: number) => {
        const state = get();
        if (!state.data) return;

        try {
          const { tauriAPI } = await import('../hooks/useTauri');

          const beforeData = {
            ...state.data,
            rows: state.data.rows.map(row => [...row])
          };

          const newData = await tauriAPI.moveColumn(state.data, fromIndex, toIndex);

          const historyAction: HistoryAction = {
            type: 'replace_all',
            data: {
              beforeData,
              afterData: newData,
              description: `Move column from position ${fromIndex + 1} to ${toIndex + 1}`
            },
            timestamp: Date.now()
          };

          set({
            data: newData,
            hasUnsavedChanges: true
          });

          get().addToHistory(historyAction);
        } catch (error) {
          console.error('Failed to move column:', error);
          set({ error: 'Failed to move column' });
        }
      },

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

        // Store before state for history - deep copy rows
        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        // Create deep copy of rows for modification
        const newRows = state.data.rows.map(row => [...row]);
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

        const afterData = { ...state.data, rows: newRows };

        // Add to history
        const historyAction: HistoryAction = {
          type: 'paste',
          data: {
            beforeData,
            afterData,
            selection: target
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        // Add to history after state update
        get().addToHistory(historyAction);
      },

      deleteSelection: () => {
        const state = get();
        if (!state.data) return;

        // Store before state for history - deep copy rows
        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        const newRows = [...state.data.rows];
        const selection = state.selectedCell || state.selectedRange || undefined;

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

        const afterData = { ...state.data, rows: newRows };

        // Add to history
        const historyAction: HistoryAction = {
          type: 'delete',
          data: {
            beforeData,
            afterData,
            selection
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        // Add to history after state update
        get().addToHistory(historyAction);
      },

      // History operations
      addToHistory: (action) => {
        const state = get();
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(action);

        // Limit history size to prevent memory issues
        const MAX_HISTORY_SIZE = 100;
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        } else {
          set({
            history: newHistory,
            historyIndex: newHistory.length - 1
          });
          return;
        }

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1
        });
      },

      undo: () => {
        const state = get();
        if (state.historyIndex < 0) return;

        const action = state.history[state.historyIndex];
        if (action) {
          set({
            data: action.data.beforeData,
            historyIndex: state.historyIndex - 1,
            hasUnsavedChanges: true
          });
        }
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;

        const action = state.history[state.historyIndex + 1];
        if (action) {
          set({
            data: action.data.afterData,
            historyIndex: state.historyIndex + 1,
            hasUnsavedChanges: true
          });
        }
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex >= 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },

      // Row operations with history
      addRow: (position, rowIndex) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };
        const newRows = [...state.data.rows];
        const newRow = new Array(state.data.headers.length).fill('');

        const insertIndex = position === 'above' ? rowIndex : rowIndex + 1;
        newRows.splice(insertIndex, 0, newRow);

        const afterData = {
          ...state.data,
          rows: newRows
        };

        const historyAction: HistoryAction = {
          type: 'add_row',
          data: {
            beforeData,
            afterData,
            selection: { row: insertIndex, column: 0, value: '' }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      deleteRow: (rowIndex) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };
        const newRows = [...state.data.rows];
        newRows.splice(rowIndex, 1);

        const afterData = {
          ...state.data,
          rows: newRows
        };

        const historyAction: HistoryAction = {
          type: 'delete_row',
          data: {
            beforeData,
            afterData,
            selection: { row: rowIndex, column: 0, value: '' }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      duplicateRow: (rowIndex) => {
        const state = get();
        if (!state.data || !state.data.rows[rowIndex]) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };
        const newRows = [...state.data.rows];
        const duplicatedRow = [...state.data.rows[rowIndex]];
        newRows.splice(rowIndex + 1, 0, duplicatedRow);

        const afterData = {
          ...state.data,
          rows: newRows
        };

        const historyAction: HistoryAction = {
          type: 'duplicate_row',
          data: {
            beforeData,
            afterData,
            selection: { row: rowIndex + 1, column: 0, value: '' }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      // Column operations with history
      addColumn: (position, columnIndex) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };
        const insertIndex = position === 'before' ? columnIndex : columnIndex + 1;

        const newHeaders = [...state.data.headers];
        newHeaders.splice(insertIndex, 0, `Column ${state.data.headers.length + 1}`);

        const newRows = state.data.rows.map(row => {
          const newRow = [...row];
          newRow.splice(insertIndex, 0, '');
          return newRow;
        });

        const afterData = {
          ...state.data,
          headers: newHeaders,
          rows: newRows
        };

        const historyAction: HistoryAction = {
          type: 'add_column',
          data: {
            beforeData,
            afterData,
            selection: { row: 0, column: insertIndex, value: '' }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      deleteColumn: (columnIndex) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        const newHeaders = [...state.data.headers];
        newHeaders.splice(columnIndex, 1);

        const newRows = state.data.rows.map(row => {
          const newRow = [...row];
          newRow.splice(columnIndex, 1);
          return newRow;
        });

        const afterData = {
          ...state.data,
          headers: newHeaders,
          rows: newRows
        };

        const historyAction: HistoryAction = {
          type: 'delete_column',
          data: {
            beforeData,
            afterData,
            selection: { row: 0, column: Math.max(0, columnIndex - 1), value: '' }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      renameColumn: (columnIndex, newName) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        const newHeaders = [...state.data.headers];
        newHeaders[columnIndex] = newName;

        const afterData = {
          ...state.data,
          headers: newHeaders
        };

        const historyAction: HistoryAction = {
          type: 'rename_column',
          data: {
            beforeData,
            afterData,
            selection: { row: 0, column: columnIndex, value: newName }
          },
          timestamp: Date.now()
        };

        set({
          data: afterData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      // Batch operations with history
      replaceAll: (newData, description) => {
        const state = get();
        if (!state.data) return;

        const beforeData = {
          ...state.data,
          rows: state.data.rows.map(row => [...row])
        };

        const historyAction: HistoryAction = {
          type: 'replace_all',
          data: {
            beforeData,
            afterData: newData,
            description: description || 'Replace all'
          },
          timestamp: Date.now()
        };

        set({
          data: newData,
          hasUnsavedChanges: true
        });

        get().addToHistory(historyAction);
      },

      // Column width operations
      setColumnWidth: (columnIndex, width) => {
        const state = get();
        set({
          columnWidths: {
            ...state.columnWidths,
            [columnIndex]: width
          }
        });
      },

      getColumnWidth: (columnIndex) => {
        const state = get();
        return state.columnWidths[columnIndex] || state.defaultColumnWidth;
      },

      resetColumnWidths: () => {
        set({ columnWidths: {} });
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
        history: [],
        historyIndex: -1,
        viewportRange: {
          startRow: 0,
          endRow: 50,
          startColumn: 0,
          endColumn: 10
        },
        columnWidths: {},
        defaultColumnWidth: 150,
        currentSort: { columns: [] }
      })
    }),
    { name: 'csv-store' }
  )
);