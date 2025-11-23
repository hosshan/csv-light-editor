import { FileText, BarChart3, Filter, Calculator, Bot } from 'lucide-react';
import { useCsvStore } from '../../store/csvStore';
import { formatNumber, formatFileSize } from '../../lib/utils';
import { AiAssistant } from '../AiAssistant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const { data, filters, sorts } = useCsvStore();

  return (
    <div className={`bg-muted/50 border-r border-border flex flex-col h-screen transition-all duration-300 overflow-hidden ${isOpen ? 'w-80' : 'w-0'}`}>
      {/* Sidebar Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isOpen ? '' : 'hidden'}`}>
        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <div className="px-2 py-2 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Info
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs">
                <Bot className="h-3 w-3 mr-1" />
                AI
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-y-auto m-0 min-h-0">
            {!data ? (
              <div className="p-4">
                <div className="text-sm text-muted-foreground text-center">
                  No file opened
                </div>
              </div>
            ) : (
              <SidebarInfo data={data} filters={filters} sorts={sorts} />
            )}
          </TabsContent>

          <TabsContent value="ai" className="flex-1 m-0 p-0 min-h-0 flex flex-col">
            <AiAssistant />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SidebarInfo({ data, filters, sorts }: { data: any; filters: any[]; sorts: any[] }) {
  return (
    <div className="flex flex-col">
      {/* File Information */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">File Information</h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rows:</span>
            <span className="font-mono">{formatNumber(data.metadata.rowCount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Columns:</span>
            <span className="font-mono">{data.metadata.columnCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size:</span>
            <span className="font-mono">{formatFileSize(data.metadata.fileSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delimiter:</span>
            <span className="font-mono">"{data.metadata.delimiter}"</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Encoding:</span>
            <span className="font-mono">{data.metadata.encoding}</span>
          </div>
        </div>
      </div>

      {/* Column Statistics */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Columns</h3>
        </div>

        <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
          {data.headers.map((header: string, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-1 hover:bg-accent rounded text-xs"
            >
              <span className="truncate flex-1" title={header}>
                {header || `Column ${index + 1}`}
              </span>
              <span className="text-muted-foreground ml-2 font-mono">
                {index}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">Active Filters</h3>
          </div>

          <div className="space-y-2 text-xs">
            {filters.map((filter, index) => (
              <div key={index} className="p-2 bg-accent rounded">
                <div className="font-medium">
                  {data.headers[filter.column] || `Column ${filter.column + 1}`}
                </div>
                <div className="text-muted-foreground">
                  {filter.operator} "{filter.value}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sorts */}
      {sorts.length > 0 && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2 mb-3">
            <Calculator className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">Sort Order</h3>
          </div>

          <div className="space-y-2 text-xs">
            {sorts.map((sort, index) => (
              <div key={index} className="p-2 bg-accent rounded">
                <div className="font-medium">
                  {data.headers[sort.column] || `Column ${sort.column + 1}`}
                </div>
                <div className="text-muted-foreground capitalize">
                  {sort.direction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />
    </div>
  );
}