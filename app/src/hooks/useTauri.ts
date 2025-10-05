import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';
import type { CsvData, CsvMetadata, SortState } from '../types/csv';

export interface SaveOptions {
  format?: 'csv' | 'tsv';
  encoding?: 'utf8' | 'shift_jis' | 'euc_jp';
  createBackup?: boolean;
}

export interface TauriCommands {
  openCsvFile: (path: string) => Promise<CsvData>;
  saveCsvFile: (path: string, data: CsvData) => Promise<void>;
  saveCsvFileAs: (path: string, data: CsvData, options: SaveOptions) => Promise<void>;
  getCurrentFile: () => Promise<string | null>;
  getCsvChunk: (path: string, startRow: number, endRow: number) => Promise<string[][]>;
  getCsvMetadata: (path: string) => Promise<CsvMetadata>;
  validateCsvFile: (path: string) => Promise<boolean>;
}

class TauriAPI {
  async openFileDialog(): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'CSV Files',
            extensions: ['csv', 'tsv']
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      return Array.isArray(selected) ? selected[0] : selected;
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      return null;
    }
  }

  async saveFileDialog(defaultPath?: string, format: 'csv' | 'tsv' = 'csv'): Promise<string | null> {
    try {
      const extension = format === 'tsv' ? 'tsv' : 'csv';
      const selected = await save({
        defaultPath,
        filters: [
          {
            name: format === 'tsv' ? 'TSV Files' : 'CSV Files',
            extensions: [extension]
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      return selected || null;
    } catch (error) {
      console.error('Failed to open save dialog:', error);
      return null;
    }
  }

  async openCsvFile(path: string): Promise<CsvData> {
    try {
      return await invoke<CsvData>('open_csv_file', { path });
    } catch (error) {
      console.error('Failed to open CSV file:', error);
      throw new Error(`Failed to open CSV file: ${error}`);
    }
  }

  async saveCsvFile(path: string, data: CsvData): Promise<void> {
    try {
      await invoke('save_csv_file', { path, data });
    } catch (error) {
      console.error('Failed to save CSV file:', error);
      throw new Error(`Failed to save CSV file: ${error}`);
    }
  }

  async saveCsvFileAs(
    path: string,
    data: CsvData,
    options: SaveOptions = {}
  ): Promise<void> {
    try {
      await invoke('save_csv_file_as', {
        path,
        data,
        format: options.format,
        encoding: options.encoding,
        createBackup: options.createBackup || false
      });
    } catch (error) {
      console.error('Failed to save CSV file as:', error);
      throw new Error(`Failed to save CSV file: ${error}`);
    }
  }

  async getCurrentFile(): Promise<string | null> {
    try {
      const result = await invoke<string | null>('get_current_file');
      return result || null;
    } catch (error) {
      console.error('Failed to get current file:', error);
      return null;
    }
  }

  async getCsvChunk(path: string, startRow: number, endRow: number): Promise<string[][]> {
    try {
      return await invoke<string[][]>('get_csv_chunk', { path, startRow, endRow });
    } catch (error) {
      console.error('Failed to get CSV chunk:', error);
      throw new Error(`Failed to get CSV chunk: ${error}`);
    }
  }

  async getCsvMetadata(path: string): Promise<CsvMetadata> {
    try {
      return await invoke<CsvMetadata>('get_csv_metadata', { path });
    } catch (error) {
      console.error('Failed to get CSV metadata:', error);
      throw new Error(`Failed to get CSV metadata: ${error}`);
    }
  }

  async validateCsvFile(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('validate_csv_file', { path });
    } catch (error) {
      console.error('Failed to validate CSV file:', error);
      return false;
    }
  }

  async sortCsvData(data: CsvData, sortState: SortState): Promise<CsvData> {
    try {
      return await invoke<CsvData>('sort_csv_data', { data, sortState });
    } catch (error) {
      console.error('Failed to sort CSV data:', error);
      throw new Error(`Failed to sort CSV data: ${error}`);
    }
  }

  async saveSortState(path: string, sortState: SortState): Promise<void> {
    try {
      await invoke('save_sort_state', { path, sortState });
    } catch (error) {
      console.error('Failed to save sort state:', error);
      throw new Error(`Failed to save sort state: ${error}`);
    }
  }

  async loadSortState(path: string): Promise<SortState | null> {
    try {
      const result = await invoke<SortState | null>('load_sort_state', { path });
      return result;
    } catch (error) {
      console.error('Failed to load sort state:', error);
      return null;
    }
  }
}

export const tauriAPI = new TauriAPI();

export function useTauri() {
  return tauriAPI;
}