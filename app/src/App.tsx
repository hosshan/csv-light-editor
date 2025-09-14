import React from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { CsvTable } from './components/csv/CsvTable';
import { useCsvStore } from './store/csvStore';
import { Loader2 } from 'lucide-react';

function App() {
  const { isLoading, error } = useCsvStore();

  return (
    <div className="app-container">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Sidebar */}
        <Sidebar />

        {/* CSV Table */}
        <div className="csv-container">
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-content">
                <div className="spinner"></div>
                <span>Loading CSV file...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-toast">
              <div className="error-title">Error</div>
              <div className="error-message">{error}</div>
            </div>
          )}

          <CsvTable />
        </div>
      </div>
    </div>
  );
}

export default App;