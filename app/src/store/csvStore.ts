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