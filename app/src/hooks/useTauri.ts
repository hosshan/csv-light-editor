import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import type { CsvData, CsvMetadata } from '../types/csv';

export interface TauriCommands {
  openCsvFile: (path: string) => Promise<CsvData>;
  saveCsvFile: (path: string, data: CsvData) => Promise<void>;
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

  async saveFileDialog(): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'CSV Files',
            extensions: ['csv']
          }
        ]
      });

      return Array.isArray(selected) ? selected[0] : selected;
    } catch (error) {
      console.error('Failed to open save dialog:', error);
      return null;
    }
  }

  async openCsvFile(path: string): Promise<CsvData> {
    try {
      console.log('Invoking open_csv_file with path:', path);
      const result = await invoke<CsvData>('open_csv_file', { path });
      console.log('Received CSV data from Tauri:', result);
      return result;
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
}

export const tauriAPI = new TauriAPI();

export function useTauri() {
  return tauriAPI;
}