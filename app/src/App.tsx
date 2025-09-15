import { useEffect, useState, useCallback } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { CsvTable } from './components/csv/CsvTable';
import { SaveDialog } from './components/SaveDialog';
import { useCsvStore } from './store/csvStore';
import { useTauri } from './hooks/useTauri';
import { Loader2 } from 'lucide-react';
import type { SaveOptions } from './hooks/useTauri';

function App() {
  const { data, currentFilePath, hasUnsavedChanges, isLoading, error, setCurrentFilePath, markSaved, setError } = useCsvStore();
  const tauriAPI = useTauri();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'save' | 'saveAs'>('save');

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

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <Toolbar onSave={handleSave} onSaveAs={() => {
        setSaveMode('saveAs');
        setShowSaveDialog(true);
      }} />

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
            <CsvTable />
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
    </div>
  );
}

export default App;