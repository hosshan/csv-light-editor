import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCsvStore } from '../../store/csvStore';
import { cn } from '../../lib/utils';
import { ColumnMenu } from '../ColumnMenu';
import { RowMenu } from '../RowMenu';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import { DragHandle } from './DragHandle';
import { DropZoneIndicator } from './DropZoneIndicator';
import { FilterBar } from '../filtering/FilterBar';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import styles from './CsvTable.module.css';

export function CsvTable() {
  const {
    data,
    filters,
    selectedCell,
    selectedRange,
    editingCell,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    extendSelection,
    startEditing,
    stopEditing,
    updateCell,
    copySelection,
    cutSelection,
    paste,
    deleteSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    addRow,
    deleteRow,
    duplicateRow,
    addColumn,
    deleteColumn,
    renameColumn,
    setColumnWidth,
    getColumnWidth,
    columnWidths,
    moveRow,
    moveColumn,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    getFilteredData,
    searchResults,
    currentSearchIndex
  } = useCsvStore();

  const [editValue, setEditValue] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Use filtered data for display
  const displayData = getFilteredData() || data;

  // Drag and drop functionality
  const { dragState, handlers } = useDragAndDrop({
    onMove: (fromIndex: number, toIndex: number, type: 'row' | 'column') => {
      if (type === 'row') {
        moveRow(fromIndex, toIndex);
      } else {
        moveColumn(fromIndex, toIndex);
      }
    },
  });

  // Virtual scrolling for rows with performance optimizations
  const rowVirtualizer = useVirtualizer({
    count: displayData?.rows.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 15, // Increased overscan for smoother scrolling
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
  });

  // Virtual scrolling for columns with performance optimizations
  const columnVirtualizer = useVirtualizer({
    count: displayData?.headers.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getColumnWidth(index),
    overscan: 8, // Increased overscan for horizontal scrolling
    horizontal: true,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().width
        : undefined,
  });

  // Force column virtualizer to recalculate when column widths change
  React.useEffect(() => {
    // Simple approach: just trigger measure when widths change
    if (columnVirtualizer) {
      columnVirtualizer.measure();
    }
  }, [columnWidths, columnVirtualizer]);

  // Sync horizontal scroll between header and content
  useEffect(() => {
    const scrollElement = parentRef.current;
    const headerElement = headerRef.current;

    if (!scrollElement || !headerElement) return;

    const handleScroll = () => {
      if (headerElement) {
        headerElement.scrollLeft = scrollElement.scrollLeft;
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, []);


  useEffect(() => {
    if (editingCell && data) {
      const cellValue = data.rows[editingCell.row]?.[editingCell.column] || '';
      setEditValue(cellValue);
    }
  }, [editingCell, data]);

  const handleCellClick = (row: number, column: number, event?: React.MouseEvent) => {
    if (!data) return;

    const cell = { row, column, value: data.rows[row]?.[column] || '' };

    // Handle shift+click for range selection
    if (event?.shiftKey) {
      extendSelection(cell);
    } else {
      selectCell(cell);
    }
  };

  const handleRowHeaderClick = (rowIndex: number, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    selectRow(rowIndex);
  };

  const handleColumnHeaderClick = (columnIndex: number, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    selectColumn(columnIndex);
  };

  const handleCellDoubleClick = (row: number, column: number) => {
    if (!data) return;

    const cell = { row, column, value: data.rows[row]?.[column] || '' };
    startEditing(cell);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!data || editingCell) return;

    // Handle Ctrl+A for select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }

    // Handle clipboard and history operations
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'c':
          e.preventDefault();
          copySelection();
          return;
        case 'x':
          e.preventDefault();
          cutSelection();
          return;
        case 'v':
          e.preventDefault();
          paste();
          return;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            // Cmd+Shift+Z for Redo
            if (canRedo()) {
              redo();
            }
          } else {
            // Cmd+Z for Undo
            if (canUndo()) {
              undo();
            }
          }
          return;
      }
    }

    // If no cell is selected and no range is selected, don't handle navigation
    if (!selectedCell && !selectedRange) return;

    // Use current selection or focus point of range for navigation
    let row: number, column: number;
    if (selectedCell) {
      row = selectedCell.row;
      column = selectedCell.column;
    } else if (selectedRange) {
      // Use focus point (current active end) if available, otherwise use start point
      row = selectedRange.focusRow ?? selectedRange.endRow;
      column = selectedRange.focusColumn ?? selectedRange.endColumn;
    } else {
      return; // Should not reach here due to check above
    }

    let newRow = row;
    let newColumn = column;

    // Handle shift+arrow keys for range selection
    if (e.shiftKey) {
      let extendToCell: { row: number; column: number; value: string } | null = null;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          extendToCell = {
            row: Math.max(0, row - 1),
            column,
            value: data.rows[Math.max(0, row - 1)]?.[column] || ''
          };
          break;
        case 'ArrowDown':
          e.preventDefault();
          extendToCell = {
            row: Math.min(data.rows.length - 1, row + 1),
            column,
            value: data.rows[Math.min(data.rows.length - 1, row + 1)]?.[column] || ''
          };
          break;
        case 'ArrowLeft':
          e.preventDefault();
          extendToCell = {
            row,
            column: Math.max(0, column - 1),
            value: data.rows[row]?.[Math.max(0, column - 1)] || ''
          };
          break;
        case 'ArrowRight':
          e.preventDefault();
          extendToCell = {
            row,
            column: Math.min(data.headers.length - 1, column + 1),
            value: data.rows[row]?.[Math.min(data.headers.length - 1, column + 1)] || ''
          };
          break;
      }

      if (extendToCell) {
        extendSelection(extendToCell);
        return;
      }
    }

    // Handle Command/Ctrl + Arrow keys for jumping to edges
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          newRow = 0; // Jump to first row
          break;
        case 'ArrowDown':
          e.preventDefault();
          newRow = data.rows.length - 1; // Jump to last row
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newColumn = 0; // Jump to first column
          break;
        case 'ArrowRight':
          e.preventDefault();
          newColumn = data.headers.length - 1; // Jump to last column
          break;
        default:
          // Let other Cmd/Ctrl combinations pass through
          break;
      }
    } else {
      // Normal navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          newRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newRow = Math.min(data.rows.length - 1, row + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newColumn = Math.max(0, column - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newColumn = Math.min(data.headers.length - 1, column + 1);
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          if (selectedCell) {
            startEditing(selectedCell);
          }
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteSelection();
          return;
      }
    }

    if (newRow !== row || newColumn !== column) {
      const newCell = {
        row: newRow,
        column: newColumn,
        value: data.rows[newRow]?.[newColumn] || ''
      };
      selectCell(newCell);

      // Scroll selected cell into view for keyboard navigation
      requestAnimationFrame(() => {
        // Scroll row into view
        const scrollToRowIndex = newRow;
        if (scrollToRowIndex >= 0 && scrollToRowIndex < (data?.rows.length || 0)) {
          rowVirtualizer.scrollToIndex(scrollToRowIndex, {
            align: 'auto',
            behavior: 'smooth'
          });
        }

        // Scroll column into view
        const scrollToColumnIndex = newColumn;
        if (scrollToColumnIndex >= 0 && scrollToColumnIndex < (data?.headers.length || 0)) {
          columnVirtualizer.scrollToIndex(scrollToColumnIndex, {
            align: 'auto',
            behavior: 'smooth'
          });
        }
      });
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell) {
        updateCell(editingCell, editValue);
        // Move to next row after saving
        if (data && editingCell.row < data.rows.length - 1) {
          const nextCell = {
            row: editingCell.row + 1,
            column: editingCell.column,
            value: data.rows[editingCell.row + 1]?.[editingCell.column] || ''
          };
          selectCell(nextCell);
        }
        // Return focus to table for arrow key navigation
        setTimeout(() => {
          parentRef.current?.focus();
        }, 0);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) {
        updateCell(editingCell, editValue);
        // Move to next column after saving
        if (data && editingCell.column < data.headers.length - 1) {
          const nextCell = {
            row: editingCell.row,
            column: editingCell.column + 1,
            value: data.rows[editingCell.row]?.[editingCell.column + 1] || ''
          };
          selectCell(nextCell);
        }
        // Return focus to table for arrow key navigation
        setTimeout(() => {
          parentRef.current?.focus();
        }, 0);
      }
    } else if (e.key === 'Escape') {
      // Cancel editing without saving
      stopEditing();
      // Return focus to table for arrow key navigation
      setTimeout(() => {
        parentRef.current?.focus();
      }, 0);
    }
  };


  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2">No CSV file loaded</div>
          <div className="text-sm">Click "Open" to load a CSV file</div>
        </div>
      </div>
    );
  }

  // Safety check for data structure
  if (!data.rows || !data.headers || !Array.isArray(data.rows) || !Array.isArray(data.headers)) {
    console.error('Invalid CSV data structure:', data);
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-destructive">
          <div className="text-lg mb-2">Invalid CSV data</div>
          <div className="text-sm">Please try loading the file again</div>
        </div>
      </div>
    );
  }

  // Debug logging
  useEffect(() => {
    console.log('CsvTable Debug:', {
      dataLength: data?.rows.length || 0,
      headersLength: data?.headers.length || 0,
      hasData: !!data
    });
  }, [data]);

  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        headers={data?.headers || []}
        onAddFilter={addFilter}
        onUpdateFilter={updateFilter}
        onRemoveFilter={removeFilter}
        onClearAll={clearFilters}
      />

      {/* Column Headers */}
      <div className="sticky top-0 z-10 bg-muted border-b border-border shrink-0 overflow-hidden">
        <div className="flex">
          {/* Row number column header */}
          <div
            className="w-12 h-10 border-r border-border bg-muted/80 flex items-center justify-center text-xs font-medium cursor-pointer hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectAll();
            }}
          >
            #
          </div>

          {/* Column headers */}
          <div
            ref={headerRef}
            className="flex relative overflow-x-hidden flex-1"
            style={{
              height: '40px',
            }}
          >
            <div
              className="relative"
              style={{
                width: columnVirtualizer.getTotalSize(),
                height: '40px',
              }}
            >
              {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
                const isColumnSelected = selectedRange?.type === 'column' &&
                  selectedRange.startColumn <= virtualColumn.index &&
                  selectedRange.endColumn >= virtualColumn.index;

                return (
                  <div
                    key={virtualColumn.index}
                    className={cn(
                      "border-r border-border bg-muted/80 flex items-center px-2 text-xs font-medium truncate cursor-pointer hover:bg-accent transition-colors relative overflow-visible",
                      {
                        'bg-primary/20 border-primary': isColumnSelected
                      }
                    )}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: virtualColumn.size,
                      height: '40px',
                      transform: `translateX(${virtualColumn.start}px)`,
                    }}
                    onMouseDown={(e) => {
                      // Don't handle column selection if clicking on drag handle
                      if ((e.target as Element).closest('[draggable="true"]')) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      handleColumnHeaderClick(virtualColumn.index, e);
                    }}
                    onDragOver={(e) => handlers.onDragOver(virtualColumn.index, e)}
                    onDragLeave={handlers.onDragLeave}
                    onDragEnter={(e) => e.preventDefault()}
                  >
                    <DragHandle
                      type="column"
                      index={virtualColumn.index}
                      isDragging={dragState.draggedIndex === virtualColumn.index && dragState.draggedType === 'column'}
                      isDropTarget={dragState.dropTargetIndex === virtualColumn.index && dragState.draggedType === 'column'}
                      onDragStart={handlers.onDragStart}
                      onDragEnd={handlers.onDragEnd}
                      className="w-4 h-full mr-1"
                    />
                    <span className="flex-1 truncate">
                      {displayData?.headers[virtualColumn.index] || `Column ${virtualColumn.index + 1}`}
                    </span>
                    <ColumnMenu
                      columnIndex={virtualColumn.index}
                      columnName={displayData?.headers[virtualColumn.index] || `Column ${virtualColumn.index + 1}`}
                      onAddColumn={(position) => {
                        addColumn(position, virtualColumn.index);
                      }}
                      onDeleteColumn={() => {
                        deleteColumn(virtualColumn.index);
                      }}
                      onRenameColumn={(newName) => {
                        renameColumn(virtualColumn.index, newName);
                      }}
                    />
                    <ColumnResizeHandle
                      columnIndex={virtualColumn.index}
                      onResize={setColumnWidth}
                      currentWidth={getColumnWidth(virtualColumn.index)}
                    />
                    <DropZoneIndicator
                      type="column"
                      position="before"
                      isVisible={dragState.dropTargetIndex === virtualColumn.index && dragState.draggedType === 'column'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table Body with Virtual Scrolling */}
      <div
        ref={parentRef}
        className={cn(
          "flex-1 overflow-auto focus:outline-none scroll-smooth",
          styles.scrollContainer
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: columnVirtualizer.getTotalSize() + 48,
            position: 'relative',
            minWidth: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div key={virtualRow.index} className="flex">
              {/* Row number */}
              <RowMenu
                rowIndex={virtualRow.index}
                onAddRow={(position) => {
                  addRow(position, virtualRow.index);
                }}
                onDeleteRow={() => {
                  deleteRow(virtualRow.index);
                }}
                onDuplicateRow={() => {
                  duplicateRow(virtualRow.index);
                }}
              >
                <div
                  className={cn(
                    "w-12 border-r border-b border-border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-accent transition-colors",
                    {
                      'bg-primary/20 border-primary': selectedRange?.type === 'row' &&
                        selectedRange.startRow <= virtualRow.index &&
                        selectedRange.endRow >= virtualRow.index
                    }
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onMouseDown={(e) => {
                    // Don't handle row selection if clicking on drag handle
                    if ((e.target as Element).closest('[draggable="true"]')) {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    handleRowHeaderClick(virtualRow.index, e);
                  }}
                  onDragOver={(e) => handlers.onDragOver(virtualRow.index, e)}
                  onDragLeave={handlers.onDragLeave}
                  onDragEnter={(e) => e.preventDefault()}
                >
                  <DragHandle
                    type="row"
                    index={virtualRow.index}
                    isDragging={dragState.draggedIndex === virtualRow.index && dragState.draggedType === 'row'}
                    isDropTarget={dragState.dropTargetIndex === virtualRow.index && dragState.draggedType === 'row'}
                    onDragStart={handlers.onDragStart}
                    onDragEnd={handlers.onDragEnd}
                    className="w-3 h-4 mb-1"
                  />
                  <span className="text-xs">
                    {virtualRow.index + 1}
                  </span>
                  <DropZoneIndicator
                    type="row"
                    position="before"
                    isVisible={dragState.dropTargetIndex === virtualRow.index && dragState.draggedType === 'row'}
                  />
                </div>
              </RowMenu>

              {/* Data cells */}
              {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
                const cellValue = displayData?.rows[virtualRow.index]?.[virtualColumn.index] || '';
                const isSelected = selectedCell?.row === virtualRow.index && selectedCell?.column === virtualColumn.index;
                const isEditing = editingCell?.row === virtualRow.index && editingCell?.column === virtualColumn.index;

                // Check if cell is in selected range
                const isInRange = selectedRange &&
                  virtualRow.index >= selectedRange.startRow &&
                  virtualRow.index <= selectedRange.endRow &&
                  virtualColumn.index >= selectedRange.startColumn &&
                  virtualColumn.index <= selectedRange.endColumn;

                // Check if this is the focus cell (active end of selection)
                const isFocusCell = selectedRange &&
                  selectedRange.focusRow === virtualRow.index &&
                  selectedRange.focusColumn === virtualColumn.index;

                // Check if cell is in search results
                const searchResultIndex = searchResults.findIndex(
                  result => result.row === virtualRow.index && result.column === virtualColumn.index
                );
                const isSearchResult = searchResultIndex !== -1;
                const isCurrentSearchResult = searchResultIndex === currentSearchIndex;

                return (
                  <div
                    key={`${virtualRow.index}-${virtualColumn.index}`}
                    className={cn(
                      'border-r border-b border-border bg-background flex items-center px-2 text-sm cursor-cell transition-colors hover:bg-accent',
                      {
                        'bg-primary/10 border-primary border-2 z-10': isSelected && !isEditing && !isCurrentSearchResult,
                        'bg-accent border-primary border-2 z-20 ring-2 ring-primary/50': isEditing,
                        'bg-primary/5': isInRange && !isSelected && !isEditing && !isFocusCell && !isSearchResult,
                        'bg-primary/15 border-primary/50 border-2 z-15': isFocusCell && !isEditing && !isCurrentSearchResult,
                        'bg-yellow-200 border-yellow-400 border-2 z-[5]': isSearchResult && !isCurrentSearchResult && !isEditing,
                        'bg-orange-300 border-orange-500 border-2 z-[30] ring-2 ring-orange-400': isCurrentSearchResult && !isEditing,
                      }
                    )}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 48,
                      width: virtualColumn.size,
                      height: virtualRow.size,
                      transform: `translate(${virtualColumn.start}px, ${virtualRow.start}px)`,
                      backfaceVisibility: 'hidden',
                    }}
                    onClick={(e) => handleCellClick(virtualRow.index, virtualColumn.index, e)}
                    onDoubleClick={() => handleCellDoubleClick(virtualRow.index, virtualColumn.index)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => {
                          if (editingCell) {
                            updateCell(editingCell, editValue);
                            setTimeout(() => {
                              parentRef.current?.focus();
                            }, 0);
                          }
                        }}
                        className="w-full bg-transparent border-none outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                      />
                    ) : (
                      <span
                        className="truncate w-full block"
                        title={cellValue.length > 20 ? cellValue : undefined}
                      >
                        {cellValue}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}