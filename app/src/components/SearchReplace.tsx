import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Replace, Loader2, AlertCircle, History, Download, Trash2 } from 'lucide-react';
import type { CsvData } from '@/types/csv';

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

interface SearchHistoryItem {
  id: string;
  searchText: string;
  replaceText?: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  selectedColumn: string;
  timestamp: number;
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
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReplacements, setSelectedReplacements] = useState<Set<number>>(new Set());

  // Load search history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('csv-search-history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load search history:', e);
      }
    }
  }, []);

  // Save to history
  const saveToHistory = (includeReplace = false) => {
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      searchText,
      replaceText: includeReplace ? replaceText : undefined,
      caseSensitive,
      wholeWord,
      useRegex,
      selectedColumn,
      timestamp: Date.now(),
    };

    const newHistory = [historyItem, ...searchHistory.filter(h => h.searchText !== searchText)].slice(0, 50);
    setSearchHistory(newHistory);
    localStorage.setItem('csv-search-history', JSON.stringify(newHistory));
  };

  // Load from history
  const loadFromHistory = (item: SearchHistoryItem) => {
    setSearchText(item.searchText);
    if (item.replaceText !== undefined) {
      setReplaceText(item.replaceText);
    }
    setCaseSensitive(item.caseSensitive);
    setWholeWord(item.wholeWord);
    setUseRegex(item.useRegex);
    setSelectedColumn(item.selectedColumn);
    setShowHistory(false);
  };

  // Delete history item
  const deleteHistoryItem = (id: string) => {
    const newHistory = searchHistory.filter(h => h.id !== id);
    setSearchHistory(newHistory);
    localStorage.setItem('csv-search-history', JSON.stringify(newHistory));
  };

  // Clear all history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('csv-search-history');
    setShowHistory(false);
  };

  // Export search results
  const exportResults = async (format: 'csv' | 'json') => {
    if (searchResults.length === 0) {
      setError('No results to export');
      return;
    }

    try {
      const data = searchResults.map(r => ({
        row: r.row_index + 1,
        column: csvData.headers[r.column_index],
        value: r.value,
        context: r.context,
      }));

      let content: string;
      let filename: string;

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `search-results-${Date.now()}.json`;
      } else {
        const headers = ['Row', 'Column', 'Value', 'Context'];
        const rows = data.map(d => [d.row, d.column, d.value, d.context]);
        content = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        filename = `search-results-${Date.now()}.csv`;
      }

      // Create download link
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setError(`Exported ${searchResults.length} result(s) to ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

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
      } else {
        saveToHistory(false);
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
      setSelectedReplacements(new Set(result.preview.map((_, idx) => idx)));
      if (result.preview.length === 0) {
        setError('No matches found to replace');
      } else {
        saveToHistory(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace preview failed');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleReplaceSelected = async () => {
    if (replacePreview.length === 0) {
      setError('Please preview replacements first');
      return;
    }

    if (selectedReplacements.size === 0) {
      setError('Please select at least one replacement');
      return;
    }

    setIsReplacing(true);
    setError(null);

    try {
      let updatedData = { ...csvData };
      let replacedCount = 0;

      // Apply only selected replacements
      const sortedIndices = Array.from(selectedReplacements).sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        const preview = replacePreview[idx];
        if (preview && updatedData.rows[preview.row_index]) {
          updatedData.rows[preview.row_index][preview.column_index] = preview.new_value;
          replacedCount++;
        }
      }

      if (onDataChange) {
        onDataChange(updatedData);
        setError(`Successfully replaced ${replacedCount} occurrence(s)`);
        setReplacePreview([]);
        setSelectedReplacements(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace failed');
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
        setSelectedReplacements(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replace failed');
    } finally {
      setIsReplacing(false);
    }
  };

  const toggleReplacement = (idx: number) => {
    const newSet = new Set(selectedReplacements);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setSelectedReplacements(newSet);
  };

  const toggleAllReplacements = () => {
    if (selectedReplacements.size === replacePreview.length) {
      setSelectedReplacements(new Set());
    } else {
      setSelectedReplacements(new Set(replacePreview.map((_, idx) => idx)));
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Find & Replace</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="find">Find</TabsTrigger>
            <TabsTrigger value="replace">Replace</TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="flex-1 overflow-y-auto mt-2 min-h-0">
            <div className="space-y-4 p-4">
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
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label className="text-right">Column:</Label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Columns</SelectItem>
                      {csvData.headers.map((header: string, index: number) => (
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

              <div className="flex gap-2 flex-wrap">
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
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={searchHistory.length === 0}
                >
                  <History className="mr-2 h-4 w-4" />
                  History ({searchHistory.length})
                </Button>
                {searchResults.length > 0 && (
                  <>
                    <Badge variant="secondary">
                      {searchResults.length} result(s)
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults('csv')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults('json')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                  </>
                )}
              </div>

              {/* Search History */}
              {showHistory && searchHistory.length > 0 && (
                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <h3 className="text-sm font-semibold">Recent Searches</h3>
                      <Button variant="ghost" size="sm" onClick={clearHistory}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {searchHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 hover:bg-muted rounded cursor-pointer transition-colors flex items-center justify-between group"
                      >
                        <div className="flex-1" onClick={() => loadFromHistory(item)}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{item.searchText}</span>
                            {item.replaceText && (
                              <>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-mono text-sm text-green-600">{item.replaceText}</span>
                              </>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            {item.caseSensitive && <Badge variant="outline" className="text-xs">Aa</Badge>}
                            {item.wholeWord && <Badge variant="outline" className="text-xs">Word</Badge>}
                            {item.useRegex && <Badge variant="outline" className="text-xs">.*</Badge>}
                            {item.selectedColumn !== 'all' && (
                              <Badge variant="outline" className="text-xs">
                                {csvData.headers[parseInt(item.selectedColumn)]}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

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
            </div>
          </TabsContent>

          <TabsContent value="replace" className="flex-1 overflow-y-auto mt-2 min-h-0">
            <div className="space-y-4 p-4">
              {/* Search Options */}
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="search-replace" className="text-right">
                    Find:
                  </Label>
                  <Input
                    id="search-replace"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Enter search text..."
                    className="col-span-3"
                  />
                </div>

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

                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label className="text-right">Column:</Label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Columns</SelectItem>
                      {csvData.headers.map((header: string, index: number) => (
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
                        id="case-sensitive-replace"
                        checked={caseSensitive}
                        onCheckedChange={(checked) => setCaseSensitive(!!checked)}
                      />
                      <Label htmlFor="case-sensitive-replace">Case sensitive</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="whole-word-replace"
                        checked={wholeWord}
                        onCheckedChange={(checked) => setWholeWord(!!checked)}
                      />
                      <Label htmlFor="whole-word-replace">Whole word</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="regex-replace"
                        checked={useRegex}
                        onCheckedChange={(checked) => setUseRegex(!!checked)}
                      />
                      <Label htmlFor="regex-replace">Regular expression</Label>
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

              <div className="flex gap-2 flex-wrap">
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
                  onClick={handleReplaceSelected}
                  disabled={isReplacing || selectedReplacements.size === 0}
                  variant="default"
                >
                  <Replace className="mr-2 h-4 w-4" />
                  Replace Selected ({selectedReplacements.size})
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
                  <>
                    <Badge variant="secondary">
                      {replacePreview.length} replacement(s)
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAllReplacements}
                    >
                      {selectedReplacements.size === replacePreview.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </>
                )}
              </div>

              {/* Replace Preview */}
              {replacePreview.length > 0 && (
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2">
                    {replacePreview.slice(0, 100).map((preview, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded transition-colors border mb-2 ${
                          selectedReplacements.has(idx)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-background border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Checkbox
                            checked={selectedReplacements.has(idx)}
                            onCheckedChange={() => toggleReplacement(idx)}
                          />
                          <Badge variant="outline" className="text-xs">
                            Row {preview.row_index + 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {csvData.headers[preview.column_index]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs ml-6">
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};