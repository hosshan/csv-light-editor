import { useCallback, useState } from 'react';
import {
  FolderOpen,
  Save,
  SaveAll,
  Undo,
  Redo,
  Search,
  Settings,
  FileText,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCsvStore } from '../../store/csvStore';
import { useTauri } from '../../hooks/useTauri';
import { DataTypeDetection } from '../DataTypeDetection';
import { SearchReplace } from '../SearchReplace';
import { ImportExportSettings } from '../ImportExportSettings';
import { SortMenu } from '../SortMenu';

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
    setError,
    undo,
    redo,
    canUndo,
    canRedo,
    replaceAll,
    currentSort,
    applySorting,
    clearSorting
  } = useCsvStore();
  const tauri = useTauri();

  // Dialog states
  const [isDataTypeDialogOpen, setIsDataTypeDialogOpen] = useState(false);
  const [isSearchReplaceDialogOpen, setIsSearchReplaceDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

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
            disabled={!canUndo}
            onClick={undo}
            className="flex items-center space-x-1"
            title="Undo (⌘Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!canRedo}
            onClick={redo}
            className="flex items-center space-x-1"
            title="Redo (⌘⇧Z)"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Data Operations */}
        <div className="flex items-center space-x-1 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            onClick={() => setIsSearchReplaceDialogOpen(true)}
            className="flex items-center space-x-1"
            title="Find & Replace (⌘F)"
          >
            <Search className="h-4 w-4" />
            <span>Find</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            onClick={() => setIsDataTypeDialogOpen(true)}
            className="flex items-center space-x-1"
            title="Data Type Detection"
          >
            <Shield className="h-4 w-4" />
            <span>Validate</span>
          </Button>

          {data && (
            <SortMenu
              headers={data.headers}
              currentSort={currentSort}
              onSortChange={applySorting}
              onClearSort={clearSorting}
            />
          )}
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
          onClick={() => setIsSettingsDialogOpen(true)}
          className="flex items-center space-x-1"
          title="Import/Export Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialogs */}
      {data && (
        <>
          <DataTypeDetection
            isOpen={isDataTypeDialogOpen}
            onClose={() => setIsDataTypeDialogOpen(false)}
            csvData={data}
          />
          <SearchReplace
            isOpen={isSearchReplaceDialogOpen}
            onClose={() => setIsSearchReplaceDialogOpen(false)}
            csvData={data}
            onDataChange={(newData) => replaceAll(newData, 'Replace all occurrences')}
          />
        </>
      )}
      <ImportExportSettings
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
      />
    </div>
  );
}