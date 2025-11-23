import { useEffect, useState, useCallback } from "react";
import { Toolbar } from "./components/layout/Toolbar";
import { Sidebar } from "./components/layout/Sidebar";
import { CsvTable } from "./components/csv/CsvTable";
import { SaveDialog } from "./components/SaveDialog";
import { FileOpenDialog } from "./components/FileOpenDialog";
import { NewFileDialog } from "./components/NewFileDialog";
import { SelectionStatistics } from "./components/SelectionStatistics";
import { InlineSearchBar } from "./components/InlineSearchBar";
import { useCsvStore } from "./store/csvStore";
import { useTauri } from "./hooks/useTauri";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./components/ui/Button";
import { Progress } from "./components/ui/progress";
import type { SaveOptions } from "./hooks/useTauri";
import { listen } from "@tauri-apps/api/event";

function App() {
  const {
    data,
    currentFilePath,
    hasUnsavedChanges,
    isLoading,
    loadingProgress,
    error,
    setData,
    setCurrentFilePath,
    markSaved,
    setError,
    setLoading,
    createNewCsv,
  } = useCsvStore();
  const tauriAPI = useTauri();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<"save" | "saveAs">("save");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"search" | "replace">("search");
  const [showFileOpenDialog, setShowFileOpenDialog] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [shouldCreateNewAfterSave, setShouldCreateNewAfterSave] =
    useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleFileOpen = useCallback(
    async (filePath: string) => {
      try {
        console.log("Opening file:", filePath);
        setLoading(true);
        const csvData = await tauriAPI.openCsvFile(filePath);
        console.log("CSV data loaded:", csvData);
        setData(csvData, filePath);
        setCurrentFilePath(filePath);
        setLoading(false);
      } catch (error) {
        console.error("Error opening file:", error);
        setError(`Failed to open file: ${error}`);
        setLoading(false);
      }
    },
    [tauriAPI, setData, setCurrentFilePath, setError, setLoading]
  );

  // Listen for file open events from macOS
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>("open-file", async (event) => {
        const filePath = event.payload;
        console.log("Received open-file event in React:", filePath);

        // Check if there's already a file open
        if (data && currentFilePath) {
          console.log("File already open, showing dialog");
          // Show confirmation dialog
          setPendingFilePath(filePath);
          setShowFileOpenDialog(true);
        } else {
          console.log("No file open, opening directly");
          // No file open, directly open the new file
          await handleFileOpen(filePath);
        }
      });

      return unlisten;
    };

    let unlistenFn: (() => void) | null = null;

    setupListener().then((fn) => {
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
        setSaveMode("saveAs");
        setShowSaveDialog(true);
      }
    } catch (error) {
      setError(String(error));
    }
  }, [data, currentFilePath, tauriAPI, markSaved, setError]);

  const handleSaveAs = useCallback(
    async (options?: SaveOptions) => {
      if (!data) return;

      try {
        const defaultName = currentFilePath
          ? currentFilePath
              .split("/")
              .pop()
              ?.replace(/\.[^/.]+$/, "")
          : "untitled";

        const filePath = await tauriAPI.saveFileDialog(
          `${defaultName}.${options?.format || "csv"}`,
          options?.format || "csv"
        );

        if (filePath) {
          if (options) {
            await tauriAPI.saveCsvFileAs(filePath, data, options);
          } else {
            await tauriAPI.saveCsvFile(filePath, data);
          }
          setCurrentFilePath(filePath);
          markSaved();

          // 保存後に新規作成するフラグが設定されている場合
          if (shouldCreateNewAfterSave) {
            createNewCsv();
            setShouldCreateNewAfterSave(false);
          }
        }
      } catch (error) {
        setError(String(error));
        setShouldCreateNewAfterSave(false);
      } finally {
        setShowSaveDialog(false);
      }
    },
    [
      data,
      currentFilePath,
      tauriAPI,
      setCurrentFilePath,
      markSaved,
      setError,
      shouldCreateNewAfterSave,
      createNewCsv,
    ]
  );

  const handleOpenFile = useCallback(async () => {
    const filePath = await tauriAPI.openFileDialog();
    if (filePath) {
      // If a file is already open, show confirmation dialog
      if (data && currentFilePath) {
        setPendingFilePath(filePath);
        setShowFileOpenDialog(true);
      } else {
        // No file open, directly open the new file
        await handleFileOpen(filePath);
      }
    }
  }, [data, currentFilePath, tauriAPI, handleFileOpen]);

  const handlePaste = useCallback(
    async (text: string) => {
      try {
        console.log("Pasting CSV text:", text.substring(0, 100));
        const csvData = await tauriAPI.parseCsvFromText(text);
        console.log("CSV data parsed:", csvData);
        setData(csvData, undefined);
        setCurrentFilePath(null);
      } catch (error) {
        console.error("Error parsing pasted CSV:", error);
        setError(`Failed to parse pasted CSV: ${error}`);
      }
    },
    [tauriAPI, setData, setCurrentFilePath, setError]
  );

  const handleNewCsv = useCallback(() => {
    // 未保存の変更がある場合は確認ダイアログを表示
    if (hasUnsavedChanges && data) {
      setShowNewFileDialog(true);
    } else {
      // 変更がない場合は直接新規作成
      createNewCsv();
    }
  }, [hasUnsavedChanges, data, createNewCsv]);

  const handleNewCsvAfterSave = useCallback(async () => {
    // 保存してから新規作成
    if (!data) return;

    try {
      if (currentFilePath) {
        // 既存ファイルに保存
        await tauriAPI.saveCsvFile(currentFilePath, data);
        markSaved();
        createNewCsv();
        setShowNewFileDialog(false);
      } else {
        // 新規ファイルとして保存（保存後に新規作成するフラグを設定）
        setShouldCreateNewAfterSave(true);
        setSaveMode("saveAs");
        setShowNewFileDialog(false);
        setShowSaveDialog(true);
      }
    } catch (error) {
      setError(String(error));
      setShouldCreateNewAfterSave(false);
    }
  }, [data, currentFilePath, tauriAPI, markSaved, createNewCsv, setError]);

  const handleNewCsvDiscard = useCallback(() => {
    // 保存せずに新規作成
    createNewCsv();
    setShowNewFileDialog(false);
  }, [createNewCsv]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        setSaveMode("saveAs");
        setShowSaveDialog(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchMode("search");
        setIsSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        setSearchMode("replace");
        setIsSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewCsv();
      }
    };

    const handlePasteEvent = (e: ClipboardEvent) => {
      // Only handle paste when no file is open
      if (!data || !currentFilePath) {
        const text = e.clipboardData?.getData("text/plain");
        if (text && text.trim()) {
          e.preventDefault();
          handlePaste(text);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePasteEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePasteEvent);
    };
  }, [
    handleSave,
    handleOpenFile,
    handlePaste,
    handleNewCsv,
    data,
    currentFilePath,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
          setSaveMode("saveAs");
          setShowSaveDialog(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onNewCsv={handleNewCsv}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} />

        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent transition-all duration-300 ${
            isSidebarOpen
              ? "left-80 -translate-x-1/2"
              : "left-0 -translate-x-1/2"
          }`}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={
            isSidebarOpen ? "サイドバーを折りたたむ" : "サイドバーを展開"
          }
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {/* CSV Table */}
        <div className="flex-1 bg-background flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-foreground w-80">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading CSV file...</span>
                <div className="w-full">
                  <Progress value={loadingProgress} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-1 text-center">
                    {loadingProgress}%
                  </div>
                </div>
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
        title={saveMode === "saveAs" ? "Save As" : "Save"}
      />

      <FileOpenDialog
        isOpen={showFileOpenDialog}
        onClose={() => {
          setShowFileOpenDialog(false);
          setPendingFilePath(null);
        }}
        onOpenInCurrentWindow={handleOpenInCurrentWindow}
        onOpenInNewWindow={handleOpenInNewWindow}
        fileName={pendingFilePath ? pendingFilePath.split("/").pop() || "" : ""}
      />

      <NewFileDialog
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onDiscard={handleNewCsvDiscard}
        onSave={handleNewCsvAfterSave}
        fileName={
          currentFilePath
            ? currentFilePath.split("/").pop() || undefined
            : undefined
        }
      />
    </div>
  );
}

export default App;
