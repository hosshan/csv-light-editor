import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings, FileDown, FileUp, Save } from 'lucide-react';

interface ImportExportSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: ExportSettings) => void;
}

export interface ExportSettings {
  encoding: string;
  delimiter: string;
  lineEnding: string;
  quoteCharacter: string;
  includeHeaders: boolean;
  dateFormat: string;
  numberFormat: string;
  createBackup: boolean;
  backupLocation: string;
}

export interface ImportSettings {
  encoding: string;
  delimiter: string;
  hasHeaders: boolean;
  skipRows: number;
  maxRows?: number;
  trimWhitespace: boolean;
  parseNumbers: boolean;
  parseDates: boolean;
  dateFormat: string;
}

export const ImportExportSettings: React.FC<ImportExportSettingsProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  // Export Settings State
  const [exportEncoding, setExportEncoding] = useState('utf8');
  const [exportDelimiter, setExportDelimiter] = useState(',');
  const [exportLineEnding, setExportLineEnding] = useState('lf');
  const [exportQuoteChar, setExportQuoteChar] = useState('"');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [exportDateFormat, setExportDateFormat] = useState('YYYY-MM-DD');
  const [exportNumberFormat, setExportNumberFormat] = useState('decimal');
  const [createBackup, setCreateBackup] = useState(true);
  const [backupLocation, setBackupLocation] = useState('same');

  // Import Settings State
  const [importEncoding, setImportEncoding] = useState('auto');
  const [importDelimiter, setImportDelimiter] = useState('auto');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [maxRows, setMaxRows] = useState('');
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [parseNumbers, setParseNumbers] = useState(true);
  const [parseDates, setParseDates] = useState(true);
  const [importDateFormat, setImportDateFormat] = useState('auto');

  const handleSaveSettings = () => {
    const settings: ExportSettings = {
      encoding: exportEncoding,
      delimiter: exportDelimiter,
      lineEnding: exportLineEnding,
      quoteCharacter: exportQuoteChar,
      includeHeaders,
      dateFormat: exportDateFormat,
      numberFormat: exportNumberFormat,
      createBackup,
      backupLocation,
    };

    if (onSave) {
      onSave(settings);
    }
    onClose();
  };

  const handleResetDefaults = (type: 'import' | 'export') => {
    if (type === 'export') {
      setExportEncoding('utf8');
      setExportDelimiter(',');
      setExportLineEnding('lf');
      setExportQuoteChar('"');
      setIncludeHeaders(true);
      setExportDateFormat('YYYY-MM-DD');
      setExportNumberFormat('decimal');
      setCreateBackup(true);
      setBackupLocation('same');
    } else {
      setImportEncoding('auto');
      setImportDelimiter('auto');
      setHasHeaders(true);
      setSkipRows(0);
      setMaxRows('');
      setTrimWhitespace(true);
      setParseNumbers(true);
      setParseDates(true);
      setImportDateFormat('auto');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Import/Export Settings</DialogTitle>
          <DialogDescription>
            Configure default settings for importing and exporting CSV files
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="export" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="export">
                <FileDown className="mr-2 h-4 w-4" />
                Export Settings
              </TabsTrigger>
              <TabsTrigger value="import">
                <FileUp className="mr-2 h-4 w-4" />
                Import Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="flex-1 overflow-y-auto mt-2 min-h-0">
              <div className="space-y-4 p-4 pb-8">
            {/* File Format Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">File Format</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export-encoding">Encoding</Label>
                  <Select value={exportEncoding} onValueChange={setExportEncoding}>
                    <SelectTrigger id="export-encoding">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf8">UTF-8</SelectItem>
                      <SelectItem value="utf8-bom">UTF-8 with BOM</SelectItem>
                      <SelectItem value="shift_jis">Shift-JIS</SelectItem>
                      <SelectItem value="euc_jp">EUC-JP</SelectItem>
                      <SelectItem value="ascii">ASCII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-delimiter">Delimiter</Label>
                  <Select value={exportDelimiter} onValueChange={setExportDelimiter}>
                    <SelectTrigger id="export-delimiter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export-line-ending">Line Ending</Label>
                  <Select value={exportLineEnding} onValueChange={setExportLineEnding}>
                    <SelectTrigger id="export-line-ending">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lf">LF (Unix/Mac)</SelectItem>
                      <SelectItem value="crlf">CRLF (Windows)</SelectItem>
                      <SelectItem value="cr">CR (Classic Mac)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-quote">Quote Character</Label>
                  <Select value={exportQuoteChar} onValueChange={setExportQuoteChar}>
                    <SelectTrigger id="export-quote">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='"'>Double Quote (")</SelectItem>
                      <SelectItem value="'">Single Quote (')</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-headers"
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(!!checked)}
                />
                <Label htmlFor="include-headers">Include headers in export</Label>
              </div>
            </div>

            <Separator />

            {/* Data Format Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Data Format</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select value={exportDateFormat} onValueChange={setExportDateFormat}>
                    <SelectTrigger id="date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="ISO8601">ISO 8601</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number-format">Number Format</Label>
                  <Select value={exportNumberFormat} onValueChange={setExportNumberFormat}>
                    <SelectTrigger id="number-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decimal">Decimal (1234.56)</SelectItem>
                      <SelectItem value="comma">Comma (1,234.56)</SelectItem>
                      <SelectItem value="european">European (1.234,56)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Backup Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Backup</h3>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-backup"
                  checked={createBackup}
                  onCheckedChange={(checked) => setCreateBackup(!!checked)}
                />
                <Label htmlFor="create-backup">Create backup before overwriting files</Label>
              </div>

              {createBackup && (
                <div className="space-y-2 ml-6">
                  <Label>Backup Location</Label>
                  <RadioGroup value={backupLocation} onValueChange={setBackupLocation}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="same" id="same-folder" />
                      <Label htmlFor="same-folder">Same folder as original file</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="backup" id="backup-folder" />
                      <Label htmlFor="backup-folder">Dedicated backup folder</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetDefaults('export')}
              >
                Reset to Defaults
              </Button>
            </div>
              </div>
            </TabsContent>

            <TabsContent value="import" className="flex-1 overflow-y-auto mt-2 min-h-0">
              <div className="space-y-4 p-4 pb-8">
            {/* File Detection Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">File Detection</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="import-encoding">Encoding</Label>
                  <Select value={importEncoding} onValueChange={setImportEncoding}>
                    <SelectTrigger id="import-encoding">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="utf8">UTF-8</SelectItem>
                      <SelectItem value="shift_jis">Shift-JIS</SelectItem>
                      <SelectItem value="euc_jp">EUC-JP</SelectItem>
                      <SelectItem value="ascii">ASCII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-delimiter">Delimiter</Label>
                  <Select value={importDelimiter} onValueChange={setImportDelimiter}>
                    <SelectTrigger id="import-delimiter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-headers"
                  checked={hasHeaders}
                  onCheckedChange={(checked) => setHasHeaders(!!checked)}
                />
                <Label htmlFor="has-headers">First row contains headers</Label>
              </div>
            </div>

            <Separator />

            {/* Data Processing Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Data Processing</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="skip-rows">Skip Rows</Label>
                  <Input
                    id="skip-rows"
                    type="number"
                    min="0"
                    value={skipRows}
                    onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-rows">Max Rows (optional)</Label>
                  <Input
                    id="max-rows"
                    type="number"
                    min="0"
                    placeholder="All rows"
                    value={maxRows}
                    onChange={(e) => setMaxRows(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trim-whitespace"
                    checked={trimWhitespace}
                    onCheckedChange={(checked) => setTrimWhitespace(!!checked)}
                  />
                  <Label htmlFor="trim-whitespace">Trim whitespace from values</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parse-numbers"
                    checked={parseNumbers}
                    onCheckedChange={(checked) => setParseNumbers(!!checked)}
                  />
                  <Label htmlFor="parse-numbers">Parse numeric values</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parse-dates"
                    checked={parseDates}
                    onCheckedChange={(checked) => setParseDates(!!checked)}
                  />
                  <Label htmlFor="parse-dates">Parse date values</Label>
                </div>
              </div>

              {parseDates && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="import-date-format">Date Format</Label>
                  <Select value={importDateFormat} onValueChange={setImportDateFormat}>
                    <SelectTrigger id="import-date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="ISO8601">ISO 8601</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetDefaults('import')}
              >
                Reset to Defaults
              </Button>
            </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveSettings}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};