import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Replace, Loader2, AlertCircle } from 'lucide-react';
import type { CsvData } from '@/types';

interface SearchReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: CsvData;
  onDataChange?: (data: CsvData) => void;
  onSelectCell?: (rowIndex: number, columnIndex: number) => void;
}

interface FindOptions {
  search_text: string;
  case_sensitive: boolean;
  whole_word: boolean;
  regex: boolean;
  column_index?: number;
}

interface SearchResult {
  row_index: number;
  column_index: number;
  value: string;
  context: string;
}

interface ReplacePreview {
  row_index: number;
  column_index: number;
  original_value: string;
  new_value: string;
}

interface ReplaceResult {
  replaced_count: number;
  data?: CsvData;
  preview: ReplacePreview[];
}

export const SearchReplace: React.FC<SearchReplaceProps> = ({
  isOpen,
  onClose,
  csvData,
  onDataChange,
  onSelectCell,
}) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [replacePreview, setReplacePreview] = useState<ReplacePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('find');

  const handleSearch = async () => {
    if (!searchText) {
      setError('Please enter search text');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const options: FindOptions = {
        search_text: searchText,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex: useRegex,
        column_index: selectedColumn === 'all' ? undefined : parseInt(selectedColumn),
      };

      const results = await invoke<SearchResult[]>('find_in_csv', {
        data: csvData,
        options,
      });

      setSearchResults(results);
      if (results.length === 0) {
        setError('No matches found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePreviewReplace = async () => {
    if (!searchText) {
      setError('Please enter search text');
      return;
    }

    setIsReplacing(true);
    setError(null);
    setReplacePreview([]);

    try {
      const options = {
        find_options: {
          search_text: searchText,
          case_sensitive: caseSensitive,
          whole_word: wholeWord,
          regex: useRegex,
          column_index: selectedColumn === 'all' ? undefined : parseInt(selectedColumn),
        },
        replace_text: replaceText,
        preview_only: true,
      };

      const result = await invoke<ReplaceResult>('replace_in_csv', {
        data: csvData,
        options,
      });

      setReplacePreview(result.preview);
      if (result.preview.length === 0) {
        setError('No matches found to replace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace preview failed');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleReplaceAll = async () => {
    if (!searchText) {
      setError('Please enter search text');
      return;
    }

    if (replacePreview.length === 0) {
      setError('Please preview replacements first');
      return;
    }

    setIsReplacing(true);
    setError(null);

    try {
      const options = {
        find_options: {
          search_text: searchText,
          case_sensitive: caseSensitive,
          whole_word: wholeWord,
          regex: useRegex,
          column_index: selectedColumn === 'all' ? undefined : parseInt(selectedColumn),
        },
        replace_text: replaceText,
        preview_only: false,
      };

      const result = await invoke<ReplaceResult>('replace_in_csv', {
        data: csvData,
        options,
      });

      if (result.data && onDataChange) {
        onDataChange(result.data);
        setError(`Successfully replaced ${result.replaced_count} occurrence(s)`);
        setReplacePreview([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace failed');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onSelectCell) {
      onSelectCell(result.row_index, result.column_index);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setSearchText('');
      setReplaceText('');
      setSearchResults([]);
      setReplacePreview([]);
      setError(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Find & Replace</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="find">Find</TabsTrigger>
            <TabsTrigger value="replace">Replace</TabsTrigger>
          </TabsList>

          <div className="space-y-4 mt-4">
            {/* Search Options */}
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-4 items-center">
                <Label htmlFor="search" className="text-right">
                  Find:
                </Label>
                <Input
                  id="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Enter search text..."
                  className="col-span-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activeTab === 'find') {
                      handleSearch();
                    }
                  }}
                />
              </div>

              {activeTab === 'replace' && (
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="replace" className="text-right">
                    Replace with:
                  </Label>
                  <Input
                    id="replace"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Enter replacement text..."
                    className="col-span-3"
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 items-center">
                <Label className="text-right">Column:</Label>
                <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Columns</SelectItem>
                    {csvData.headers.map((header, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-start-2 col-span-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="case-sensitive"
                      checked={caseSensitive}
                      onCheckedChange={(checked) => setCaseSensitive(!!checked)}
                    />
                    <Label htmlFor="case-sensitive">Case sensitive</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="whole-word"
                      checked={wholeWord}
                      onCheckedChange={(checked) => setWholeWord(!!checked)}
                    />
                    <Label htmlFor="whole-word">Whole word</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="regex"
                      checked={useRegex}
                      onCheckedChange={(checked) => setUseRegex(!!checked)}
                    />
                    <Label htmlFor="regex">Regular expression</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Error/Success Alert */}
            {error && (
              <Alert variant={error.includes('Successfully') ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="find" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find All
                    </>
                  )}
                </Button>
                {searchResults.length > 0 && (
                  <Badge variant="secondary">
                    {searchResults.length} result(s)
                  </Badge>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2">
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="p-2 hover:bg-muted rounded cursor-pointer transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Row {result.row_index + 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {csvData.headers[result.column_index]}
                          </Badge>
                        </div>
                        <div className="text-sm mt-1 font-mono text-muted-foreground">
                          {result.context}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="replace" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handlePreviewReplace} disabled={isReplacing}>
                  {isReplacing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Preview'
                  )}
                </Button>
                <Button
                  onClick={handleReplaceAll}
                  disabled={isReplacing || replacePreview.length === 0}
                  variant="destructive"
                >
                  <Replace className="mr-2 h-4 w-4" />
                  Replace All
                </Button>
                {replacePreview.length > 0 && (
                  <Badge variant="secondary">
                    {replacePreview.length} replacement(s)
                  </Badge>
                )}
              </div>

              {/* Replace Preview */}
              {replacePreview.length > 0 && (
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2">
                    {replacePreview.slice(0, 100).map((preview, idx) => (
                      <div
                        key={idx}
                        className="p-2 hover:bg-muted rounded transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            Row {preview.row_index + 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {csvData.headers[preview.column_index]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Original: </span>
                            <span className="font-mono">{preview.original_value}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">New: </span>
                            <span className="font-mono text-green-600">{preview.new_value}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {replacePreview.length > 100 && (
                      <div className="text-center text-sm text-muted-foreground mt-2">
                        Showing first 100 of {replacePreview.length} replacements
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};