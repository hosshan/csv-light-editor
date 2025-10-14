import { useEffect, useState, useCallback } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { CsvTable } from './components/csv/CsvTable';
import { SaveDialog } from './components/SaveDialog';
import { FileOpenDialog } from './components/FileOpenDialog';
import { SelectionStatistics } from './components/SelectionStatistics';
import { InlineSearchBar } from './components/InlineSearchBar';
import { useCsvStore } from './store/csvStore';
import { useTauri } from './hooks/useTauri';
import { Loader2 } from 'lucide-react';
import type { SaveOptions } from './hooks/useTauri';
import { listen } from '@tauri-apps/api/event';

function App() {
  const { data, currentFilePath, hasUnsavedChanges, isLoading, error, setData, setCurrentFilePath, markSaved, setError } = useCsvStore();
  const tauriAPI = useTauri();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'save' | 'saveAs'>('save');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'replace'>('search');
  const [showFileOpenDialog, setShowFileOpenDialog] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);

  const handleFileOpen = useCallback(async (filePath: string) => {
    try {
      console.log('Opening file:', filePath);
      const csvData = await tauriAPI.openCsvFile(filePath);
      console.log('CSV data loaded:', csvData);
      setData(csvData, filePath);
      setCurrentFilePath(filePath);
    } catch (error) {
      console.error('Error opening file:', error);
      setError(`Failed to open file: ${error}`);
    }
  }, [tauriAPI, setData, setCurrentFilePath, setError]);

  // Listen for file open events from macOS
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>('open-file', async (event) => {
        const filePath = event.payload;
        console.log('Received open-file event in React:', filePath);

        // Check if there's already a file open
        if (data && currentFilePath) {
          console.log('File already open, showing dialog');
          // Show confirmation dialog
          setPendingFilePath(filePath);
          setShowFileOpenDialog(true);
        } else {
          console.log('No file open, opening directly');
          // No file open, directly open the new file
          await handleFileOpen(filePath);
        }
      });

      return unlisten;
    };

    let unlistenFn: (() => void) | null = null;

    setupListener().then(fn => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [data, currentFilePath, handleFileOpen]);

  const handleSave = useCallback(async () => {
    if (!data) return;

    try {
      if (currentFilePath) {
        await tauriAPI.saveCsvFile(currentFilePath, data);
        markSaved();
      } else {
        setSaveMode('saveAs');
        setShowSaveDialog(true);
      }
    } catch (error) {
      setError(String(error));
    }
  }, [data, currentFilePath, tauriAPI, markSaved, setError]);

  const handleSaveAs = useCallback(async (options?: SaveOptions) => {
    if (!data) return;

    try {
      const defaultName = currentFilePath ?
        currentFilePath.split('/').pop()?.replace(/\.[^/.]+$/, '') :
        'untitled';

      const filePath = await tauriAPI.saveFileDialog(
        `${defaultName}.${options?.format || 'csv'}`,
        options?.format || 'csv'
      );

      if (filePath) {
        if (options) {
          await tauriAPI.saveCsvFileAs(filePath, data, options);
        } else {
          await tauriAPI.saveCsvFile(filePath, data);
        }
        setCurrentFilePath(filePath);
        markSaved();
      }
    } catch (error) {
      setError(String(error));
    } finally {
      setShowSaveDialog(false);
    }
  }, [data, currentFilePath, tauriAPI, setCurrentFilePath, markSaved, setError]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        setSaveMode('saveAs');
        setShowSaveDialog(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchMode('search');
        setIsSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        setSearchMode('replace');
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleOpenInCurrentWindow = useCallback(async () => {
    if (pendingFilePath) {
      await handleFileOpen(pendingFilePath);
      setPendingFilePath(null);
      setShowFileOpenDialog(false);
    }
  }, [pendingFilePath, handleFileOpen]);

  const handleOpenInNewWindow = useCallback(async () => {
    if (pendingFilePath) {
      try {
        await tauriAPI.openFileInNewWindow(pendingFilePath);
        setPendingFilePath(null);
        setShowFileOpenDialog(false);
      } catch (error) {
        setError(`Failed to open file in new window: ${error}`);
      }
    }
  }, [pendingFilePath, tauriAPI, setError]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <Toolbar
        onSave={handleSave}
        onSaveAs={() => {
          setSaveMode('saveAs');
          setShowSaveDialog(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* CSV Table */}
        <div className="flex-1 bg-background flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex items-center gap-2 text-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading CSV file...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 right-4 z-50 bg-destructive text-destructive-foreground p-3 rounded-md shadow-lg max-w-sm">
              <div className="font-semibold mb-1">Error</div>
              <div className="text-sm opacity-90">{error}</div>
            </div>
          )}

          {/* Wrap CsvTable in error boundary */}
          {data ? (
            <>
              <div className="relative flex-1 flex flex-col overflow-hidden">
                <InlineSearchBar
                  isOpen={isSearchOpen}
                  onClose={() => setIsSearchOpen(false)}
                  initialMode={searchMode}
                />
                <CsvTable />
              </div>
              <SelectionStatistics />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="text-lg mb-2">No CSV file loaded</div>
                <div className="text-sm">Click "Open" to load a CSV file</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveAs}
        title={saveMode === 'saveAs' ? 'Save As' : 'Save'}
      />

      <FileOpenDialog
        isOpen={showFileOpenDialog}
        onClose={() => {
          setShowFileOpenDialog(false);
          setPendingFilePath(null);
        }}
        onOpenInCurrentWindow={handleOpenInCurrentWindow}
        onOpenInNewWindow={handleOpenInNewWindow}
        fileName={pendingFilePath ? pendingFilePath.split('/').pop() || '' : ''}
      />
    </div>
  );
}

export default App;