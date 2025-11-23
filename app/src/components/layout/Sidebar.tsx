import { FileText, BarChart3, Filter, Calculator, Bot, Circle } from "lucide-react";
import { useCsvStore } from "../../store/csvStore";
import { formatNumber, formatFileSize } from "../../lib/utils";
import { AiAssistant } from "../AiAssistant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const { data, filters, sorts, currentFilePath, hasUnsavedChanges } = useCsvStore();

  return (
    <div
      className={`bg-muted/50 border-r border-border flex flex-col h-full transition-all duration-300 overflow-hidden ${isOpen ? "w-80" : "w-0"}`}
    >
      {/* Sidebar Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isOpen ? "" : "hidden"}`}>
        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
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

          <TabsContent
            value="info"
            className="flex-1 flex flex-col min-h-0 overflow-hidden m-0 p-0 data-[state=inactive]:hidden"
          >
            <div className="flex-1 overflow-y-auto min-h-0">
              {!data ? (
                <div className="p-4">
                  <div className="text-sm text-muted-foreground text-center">No file opened</div>
                </div>
              ) : (
                <SidebarInfo
                  data={data}
                  filters={filters}
                  sorts={sorts}
                  currentFilePath={currentFilePath}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="ai"
            className="flex-1 flex flex-col min-h-0 overflow-hidden m-0 p-0 data-[state=inactive]:hidden"
          >
            <AiAssistant />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SidebarInfo({
  data,
  filters,
  sorts,
  currentFilePath,
  hasUnsavedChanges,
}: {
  data: any;
  filters: any[];
  sorts: any[];
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
}) {
  const fileName = currentFilePath ? currentFilePath.split("/").pop() : "Untitled";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* File Information */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center space-x-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">File Information</h3>
        </div>

        {/* File Name */}
        <div className="mb-3 pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium truncate" title={currentFilePath || undefined}>
              {fileName}
            </span>
            {hasUnsavedChanges && (
              <span className="flex items-center space-x-1 text-orange-500 text-xs">
                <Circle className="h-2 w-2 fill-current" />
                <span>Unsaved</span>
              </span>
            )}
          </div>
          {currentFilePath && (
            <div className="text-xs text-muted-foreground mt-1 truncate" title={currentFilePath}>
              {currentFilePath}
            </div>
          )}
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
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center space-x-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Columns</h3>
        </div>

        <div className="space-y-1 text-xs max-h-64 overflow-y-auto">
          {data.headers.map((header: string, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-1 hover:bg-accent rounded text-xs"
            >
              <span className="truncate flex-1" title={header}>
                {header || `Column ${index + 1}`}
              </span>
              <span className="text-muted-foreground ml-2 font-mono">{index}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="p-4 border-b border-border flex-shrink-0">
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
        <div className="p-4 border-b border-border flex-shrink-0">
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
                <div className="text-muted-foreground capitalize">{sort.direction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />
    </div>
  );
}
