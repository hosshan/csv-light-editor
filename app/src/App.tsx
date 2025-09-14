import React from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { CsvTable } from './components/csv/CsvTable';
import { useCsvStore } from './store/csvStore';
import { Loader2 } from 'lucide-react';

function App() {
  const { isLoading, error } = useCsvStore();

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* CSV Table */}
        <div className="flex-1 relative bg-background">
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

          <CsvTable />
        </div>
      </div>
    </div>
  );
}

export default App;