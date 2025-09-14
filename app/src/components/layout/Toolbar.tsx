import { useCallback } from 'react';
import {
  FolderOpen,
  Save,
  SaveAll,
  Undo,
  Redo,
  Filter,
  Search,
  Settings,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCsvStore } from '../../store/csvStore';
import { useTauri } from '../../hooks/useTauri';

interface ToolbarProps {
  onSave?: () => void;
  onSaveAs?: () => void;
}

export function Toolbar({ onSave, onSaveAs }: ToolbarProps = {}) {
  const {
    data,
    currentFilePath,
    hasUnsavedChanges,
    setLoading,
    setData,
    setCurrentFilePath,
    setError
  } = useCsvStore();
  const tauri = useTauri();

  const handleOpenFile = async () => {
    try {
      setLoading(true);
      const filePath = await tauri.openFileDialog();

      if (filePath) {
        const csvData = await tauri.openCsvFile(filePath);
        setData(csvData, filePath);
        setCurrentFilePath(filePath);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to open file');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = useCallback(() => {
    if (onSave) {
      onSave();
    }
  }, [onSave]);

  const handleSaveAsFile = useCallback(() => {
    if (onSaveAs) {
      onSaveAs();
    }
  }, [onSaveAs]);

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
            title="Save (⌘S)"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveAsFile}
            disabled={!data}
            className="flex items-center space-x-1"
            title="Save As... (⌘⇧S)"
          >
            <SaveAll className="h-4 w-4" />
            <span>Save As</span>
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
            <span>
              {currentFilePath ? currentFilePath.split('/').pop() : 'Untitled'}
            </span>
            {hasUnsavedChanges && (
              <span className="text-orange-500">• Unsaved</span>
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