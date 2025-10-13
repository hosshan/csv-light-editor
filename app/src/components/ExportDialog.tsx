import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import { save } from '@tauri-apps/api/dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileDown, Eye, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import type { CsvData } from '@/types/csv';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: CsvData;
  onExportComplete?: () => void;
}

type ExportFormat = 'csv' | 'tsv' | 'markdown' | 'jsonarray' | 'jsonobject';

interface ExportOptions {
  format: ExportFormat;
  include_headers: boolean;
  pretty_print: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  csvData,
  onExportComplete,
}) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);
  const [preview, setPreview] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
  }, [isOpen, format, includeHeaders, prettyPrint]);

  const generatePreview = async () => {
    setIsGeneratingPreview(true);
    setError(null);
    try {
      const options: ExportOptions = {
        format,
        include_headers: includeHeaders,
        pretty_print: prettyPrint,
      };

      const previewText = await invoke<string>('generate_export_preview', {
        data: csvData,
        options,
        maxRows: 10,
      });

      setPreview(previewText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);

    try {
      // Get file extension based on format
      const extensions: Record<ExportFormat, string> = {
        csv: 'csv',
        tsv: 'tsv',
        markdown: 'md',
        jsonarray: 'json',
        jsonobject: 'json',
      };

      const ext = extensions[format];
      const defaultPath = csvData.metadata?.file_path
        ? csvData.metadata.file_path.replace(/\.[^.]+$/, `.${ext}`)
        : `export.${ext}`;

      // Show save dialog
      const filePath = await save({
        defaultPath,
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [ext],
          },
        ],
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      // Export data
      const options: ExportOptions = {
        format,
        include_headers: includeHeaders,
        pretty_print: prettyPrint,
      };

      await invoke('export_data', {
        path: filePath,
        data: csvData,
        options,
      });

      setSuccess(true);
      if (onExportComplete) {
        onExportComplete();
      }

      // Auto-close after success
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    setIsCopying(true);
    setError(null);
    setCopySuccess(false);

    try {
      const options: ExportOptions = {
        format,
        include_headers: includeHeaders,
        pretty_print: prettyPrint,
      };

      await invoke('copy_to_clipboard', {
        data: csvData,
        options,
      });

      setCopySuccess(true);

      // Reset success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy to clipboard');
    } finally {
      setIsCopying(false);
    }
  };

  const getFormatDescription = (fmt: ExportFormat): string => {
    const descriptions: Record<ExportFormat, string> = {
      csv: 'Standard comma-separated values format',
      tsv: 'Tab-separated values format',
      markdown: 'GitHub-flavored Markdown table',
      jsonarray: 'JSON array of arrays',
      jsonobject: 'JSON array of objects (with headers as keys)',
    };
    return descriptions[fmt];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose export format and options
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="format" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="format">
              <FileDown className="mr-2 h-4 w-4" />
              Format & Options
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="format" className="flex-1 overflow-y-auto mt-2 min-h-0">
            <div className="space-y-4 p-4">
              {/* Format Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Export Format</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="csv" id="format-csv" className="mt-1" />
                      <div>
                        <Label htmlFor="format-csv" className="font-medium cursor-pointer">
                          CSV (Comma-Separated Values)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {getFormatDescription('csv')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="tsv" id="format-tsv" className="mt-1" />
                      <div>
                        <Label htmlFor="format-tsv" className="font-medium cursor-pointer">
                          TSV (Tab-Separated Values)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {getFormatDescription('tsv')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="markdown" id="format-markdown" className="mt-1" />
                      <div>
                        <Label htmlFor="format-markdown" className="font-medium cursor-pointer">
                          Markdown Table
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {getFormatDescription('markdown')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="jsonarray" id="format-json-array" className="mt-1" />
                      <div>
                        <Label htmlFor="format-json-array" className="font-medium cursor-pointer">
                          JSON (Array Format)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {getFormatDescription('jsonarray')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="jsonobject" id="format-json-object" className="mt-1" />
                      <div>
                        <Label htmlFor="format-json-object" className="font-medium cursor-pointer">
                          JSON (Object Format)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {getFormatDescription('jsonobject')}
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Options */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Export Options</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-headers"
                    checked={includeHeaders}
                    onCheckedChange={(checked) => setIncludeHeaders(!!checked)}
                  />
                  <Label htmlFor="include-headers" className="cursor-pointer">
                    Include column headers
                  </Label>
                </div>

                {(format === 'jsonarray' || format === 'jsonobject') && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pretty-print"
                      checked={prettyPrint}
                      onCheckedChange={(checked) => setPrettyPrint(!!checked)}
                    />
                    <Label htmlFor="pretty-print" className="cursor-pointer">
                      Pretty print (formatted JSON)
                    </Label>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="pt-4 border-t">
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Rows:</span> {csvData.rows.length.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Columns:</span> {csvData.headers.length}
                  </div>
                  <div>
                    <span className="font-medium">Format:</span> {format.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-2 min-h-0">
            <div className="h-full flex flex-col p-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">
                  Preview (first 10 rows)
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generatePreview}
                  disabled={isGeneratingPreview}
                >
                  {isGeneratingPreview ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <pre className="p-4 text-xs font-mono whitespace-pre">
                  {preview || 'No preview available'}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="flex-shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Export completed successfully!</AlertDescription>
          </Alert>
        )}

        {copySuccess && (
          <Alert className="flex-shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Copied to clipboard successfully!</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isExporting || isCopying}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleCopyToClipboard}
            disabled={isExporting || isCopying}
          >
            {isCopying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Copying...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button onClick={handleExport} disabled={isExporting || isCopying}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Export to File
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
