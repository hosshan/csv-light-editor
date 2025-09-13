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
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading CSV file...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 right-4 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-lg">
              <div className="font-medium">Error</div>
              <div className="text-sm">{error}</div>
            </div>
          )}

          <CsvTable />
        </div>
      </div>
    </div>
  );
}

export default App;