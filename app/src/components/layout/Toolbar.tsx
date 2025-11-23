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
  Shield,
  CheckSquare,
  BarChart3,
  FileDown,
  FilePlus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCsvStore } from '../../store/csvStore';
import { useTauri } from '../../hooks/useTauri';
import { DataTypeDetection } from '../DataTypeDetection';
import { SearchReplace } from '../SearchReplace';
import { ImportExportSettings } from '../ImportExportSettings';
import { SortMenu } from '../SortMenu';
import { CustomValidation } from '../CustomValidation';
import { DataQuality } from '../DataQuality';
import { ExportDialog } from '../ExportDialog';

interface ToolbarProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenSearch?: () => void;
  onNewCsv?: () => void;
}

export function Toolbar({ onSave, onSaveAs, onOpenSearch, onNewCsv }: ToolbarProps = {}) {
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
  const [isCustomValidationOpen, setIsCustomValidationOpen] = useState(false);
  const [isDataQualityOpen, setIsDataQualityOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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
            onClick={onNewCsv || (() => {})}
            className="flex items-center space-x-1"
            title="New CSV (⌘N)"
          >
            <FilePlus className="h-4 w-4" />
            <span>New</span>
          </Button>

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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={!data}
            className="flex items-center space-x-1"
            title="Export to other formats"
          >
            <FileDown className="h-4 w-4" />
            <span>Export</span>
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
            onClick={() => onOpenSearch && onOpenSearch()}
            className="flex items-center space-x-1"
            title="Find (⌘F)"
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
            <span>Types</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            onClick={() => setIsCustomValidationOpen(true)}
            className="flex items-center space-x-1"
            title="Custom Validation Rules"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Rules</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!data}
            onClick={() => setIsDataQualityOpen(true)}
            className="flex items-center space-x-1"
            title="Data Quality Analysis"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Quality</span>
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
          <CustomValidation
            isOpen={isCustomValidationOpen}
            onClose={() => setIsCustomValidationOpen(false)}
            csvData={data}
          />
          <DataQuality
            isOpen={isDataQualityOpen}
            onClose={() => setIsDataQualityOpen(false)}
            csvData={data}
            onApplyCleansing={(result) => {
              console.log('Cleansing applied:', result);
              // Reload data or update UI
            }}
          />
          <ExportDialog
            isOpen={isExportDialogOpen}
            onClose={() => setIsExportDialogOpen(false)}
            csvData={data}
            onExportComplete={() => {
              console.log('Export completed');
            }}
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