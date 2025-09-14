import React from 'react';
import {
  FolderOpen,
  Save,
  Undo,
  Redo,
  Filter,
  Search,
  Settings,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCsvStore } from '../../store/csvStore';
import { useTauri } from '../../hooks/useTauri';

export function Toolbar() {
  const {
    data,
    hasUnsavedChanges,
    setLoading,
    setData,
    setError,
    reset
  } = useCsvStore();
  const tauri = useTauri();

  const handleOpenFile = async () => {
    try {
      setLoading(true);
      console.log('Opening file dialog...');
      const filePath = await tauri.openFileDialog();
      console.log('Selected file:', filePath);

      if (filePath) {
        console.log('Loading CSV file...');
        const csvData = await tauri.openCsvFile(filePath);
        console.log('CSV data received:', csvData);
        setData(csvData);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      setError(error instanceof Error ? error.message : 'Failed to open file');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!data) return;

    try {
      setLoading(true);
      await tauri.saveCsvFile(data.metadata.path, data);
      // Mark as saved in store
      useCsvStore.getState().markSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border">
      <div className="flex items-center space-x-2">
        {/* File Operations */}
        <div className="flex items-center space-x-1 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenFile}
            className="flex items-center space-x-1"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Open</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveFile}
            disabled={!data || !hasUnsavedChanges}
            className="flex items-center space-x-1"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </Button>
        </div>

        {/* Edit Operations */}
        <div className="flex items-center space-x-1 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={true} // TODO: Implement undo/redo
            className="flex items-center space-x-1"
          >
            <Undo className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={true} // TODO: Implement undo/redo
            className="flex items-center space-x-1"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* View Operations */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            className="flex items-center space-x-1"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            className="flex items-center space-x-1"
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Button>
        </div>
      </div>

      {/* File Info and Settings */}
      <div className="flex items-center space-x-2">
        {data && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{data.metadata.filename}</span>
            {hasUnsavedChanges && (
              <span className="text-orange-500">•</span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-1"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}