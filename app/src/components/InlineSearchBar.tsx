import React, { useState, useEffect, useRef } from 'react';
import { useCsvStore } from '../store/csvStore';
import { Input } from './ui/input';
import { Button } from './ui/Button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { X, ChevronUp, ChevronDown, Search, Replace, GripVertical } from 'lucide-react';

interface InlineSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'search' | 'replace';
}

export function InlineSearchBar({ isOpen, onClose, initialMode = 'search' }: InlineSearchBarProps) {
  const {
    searchQuery,
    searchResults,
    currentSearchIndex,
    searchOptions,
    setSearchQuery,
    performSearch,
    clearSearch,
    nextSearchResult,
    previousSearchResult,
    replaceCurrentResult,
    replaceAllResults,
  } = useCsvStore();

  const [mode, setMode] = useState<'search' | 'replace'>(initialMode);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(searchOptions.caseSensitive);
  const [wholeWord, setWholeWord] = useState(searchOptions.wholeWord);
  const [useRegex, setUseRegex] = useState(searchOptions.regex);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setLocalQuery(searchQuery);
      setCaseSensitive(searchOptions.caseSensitive);
      setWholeWord(searchOptions.wholeWord);
      setUseRegex(searchOptions.regex);
    }
  }, [isOpen, searchQuery, searchOptions, initialMode]);

  const handleSearch = () => {
    if (!localQuery) return;
    setSearchQuery(localQuery, { caseSensitive, wholeWord, regex: useRegex });
    // Small delay to ensure state is updated
    setTimeout(() => {
      performSearch();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        previousSearchResult();
      } else {
        if (localQuery !== searchQuery) {
          handleSearch();
        } else {
          nextSearchResult();
        }
      }
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleReplaceCurrent = () => {
    replaceCurrentResult(replaceText);
  };

  const handleReplaceAll = () => {
    replaceAllResults(replaceText);
  };

  const handleClose = () => {
    clearSearch();
    setLocalQuery('');
    setReplaceText('');
    onClose();
  };

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Constrain to viewport
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Reset position when opening
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const style: React.CSSProperties = position.x === 0 && position.y === 0
    ? { top: '0.5rem', right: '0.5rem' }
    : { top: `${position.y}px`, left: `${position.x}px` };

  return (
    <div
      ref={panelRef}
      className="absolute z-50 bg-background border border-border rounded-md shadow-lg p-3 min-w-[450px] pointer-events-auto"
      style={style}
    >
      {/* Drag Handle and Mode Toggle */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="cursor-move p-1 hover:bg-accent rounded"
          onMouseDown={handleDragStart}
          title="Drag to move"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Button
          variant={mode === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('search')}
        >
          <Search className="h-4 w-4 mr-1" />
          Find
        </Button>
        <Button
          variant={mode === 'replace' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('replace')}
        >
          <Replace className="h-4 w-4 mr-1" />
          Replace
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find in table..."
            className="pl-8 pr-20"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
              <span>
                {currentSearchIndex + 1} / {searchResults.length}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={previousSearchResult}
            disabled={searchResults.length === 0}
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextSearchResult}
            disabled={searchResults.length === 0}
            title="Next (Enter)"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Replace Input (only in replace mode) */}
      {mode === 'replace' && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 relative">
            <Replace className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceCurrent}
              disabled={searchResults.length === 0}
              title="Replace current"
            >
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceAll}
              disabled={searchResults.length === 0}
              title="Replace all"
            >
              Replace All
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id="case-sensitive-inline"
            checked={caseSensitive}
            onCheckedChange={(checked) => {
              setCaseSensitive(!!checked);
              if (localQuery) {
                setSearchQuery(localQuery, { caseSensitive: !!checked, wholeWord, regex: useRegex });
                setTimeout(() => performSearch(), 0);
              }
            }}
          />
          <Label htmlFor="case-sensitive-inline" className="text-xs cursor-pointer">
            Match case
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="whole-word-inline"
            checked={wholeWord}
            onCheckedChange={(checked) => {
              setWholeWord(!!checked);
              if (localQuery) {
                setSearchQuery(localQuery, { caseSensitive, wholeWord: !!checked, regex: useRegex });
                setTimeout(() => performSearch(), 0);
              }
            }}
          />
          <Label htmlFor="whole-word-inline" className="text-xs cursor-pointer">
            Whole word
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="regex-inline"
            checked={useRegex}
            onCheckedChange={(checked) => {
              setUseRegex(!!checked);
              if (localQuery) {
                setSearchQuery(localQuery, { caseSensitive, wholeWord, regex: !!checked });
                setTimeout(() => performSearch(), 0);
              }
            }}
          />
          <Label htmlFor="regex-inline" className="text-xs cursor-pointer">
            Regex
          </Label>
        </div>
      </div>
    </div>
  );
}
