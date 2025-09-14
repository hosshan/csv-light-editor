import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCsvStore } from '../../store/csvStore';
import { cn } from '../../lib/utils';

export function CsvTable() {
  const {
    data,
    selectedCell,
    editingCell,
    selectCell,
    startEditing,
    stopEditing,
    updateCell
  } = useCsvStore();

  const [editValue, setEditValue] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling for rows
  const rowVirtualizer = useVirtualizer({
    count: data?.rows.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  // Virtual scrolling for columns
  const columnVirtualizer = useVirtualizer({
    count: data?.headers.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
    horizontal: true,
  });

  useEffect(() => {
    if (editingCell && data) {
      const cellValue = data.rows[editingCell.row]?.[editingCell.column] || '';
      setEditValue(cellValue);
    }
  }, [editingCell, data]);

  const handleCellClick = (row: number, column: number) => {
    if (!data) return;

    const cell = { row, column, value: data.rows[row]?.[column] || '' };
    selectCell(cell);
  };

  const handleCellDoubleClick = (row: number, column: number) => {
    if (!data) return;

    const cell = { row, column, value: data.rows[row]?.[column] || '' };
    startEditing(cell);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!data || !selectedCell || editingCell) return;

    const { row, column } = selectedCell;
    let newRow = row;
    let newColumn = column;

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
        startEditing(selectedCell);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        updateCell(selectedCell, '');
        return;
    }

    if (newRow !== row || newColumn !== column) {
      const newCell = {
        row: newRow,
        column: newColumn,
        value: data.rows[newRow]?.[newColumn] || ''
      };
      selectCell(newCell);
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

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Column Headers */}
      <div className="sticky top-0 z-10 bg-muted border-b border-border">
        <div className="flex">
          {/* Row number column header */}
          <div className="w-12 h-10 border-r border-border bg-muted/80 flex items-center justify-center text-xs font-medium">
            #
          </div>

          {/* Column headers */}
          <div
            className="flex relative"
            style={{
              width: columnVirtualizer.getTotalSize(),
              height: '40px',
            }}
          >
            {columnVirtualizer.getVirtualItems().map((virtualColumn) => (
              <div
                key={virtualColumn.index}
                className="border-r border-border bg-muted/80 flex items-center px-2 text-xs font-medium truncate"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: virtualColumn.size,
                  height: '40px',
                  transform: `translateX(${virtualColumn.start}px)`,
                }}
              >
                {data.headers[virtualColumn.index] || `Column ${virtualColumn.index + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Body with Virtual Scrolling */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto focus:outline-none"
        style={{ minHeight: '400px' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: columnVirtualizer.getTotalSize() + 48, // +48 for row number column
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div key={virtualRow.index} className="flex">
              {/* Row number */}
              <div
                className="w-12 border-r border-b border-border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {virtualRow.index + 1}
              </div>

              {/* Data cells */}
              {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
                const cellValue = data.rows[virtualRow.index]?.[virtualColumn.index] || '';
                const isSelected = selectedCell?.row === virtualRow.index && selectedCell?.column === virtualColumn.index;
                const isEditing = editingCell?.row === virtualRow.index && editingCell?.column === virtualColumn.index;

                return (
                  <div
                    key={virtualColumn.index}
                    className={cn(
                      'border-r border-b border-border bg-background flex items-center px-2 text-sm cursor-cell transition-colors hover:bg-accent',
                      {
                        'bg-primary/10 border-primary border-2 z-10': isSelected && !isEditing,
                        'bg-accent border-primary border-2 z-20 ring-2 ring-primary/50': isEditing,
                      }
                    )}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 48, // offset for row number column
                      width: virtualColumn.size,
                      height: virtualRow.size,
                      transform: `translate(${virtualColumn.start}px, ${virtualRow.start}px)`,
                    }}
                    onClick={() => handleCellClick(virtualRow.index, virtualColumn.index)}
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
                            // Return focus to table for arrow key navigation
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
                      <span className="truncate w-full" title={cellValue}>
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