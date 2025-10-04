import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/Button';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortState, SortDirection, SortColumn } from '@/types/csv';

interface SortMenuProps {
  headers: string[];
  currentSort: SortState;
  onSortChange: (sortState: SortState) => void;
  onClearSort: () => void;
}

export const SortMenu: React.FC<SortMenuProps> = ({
  headers,
  currentSort,
  onSortChange,
  onClearSort,
}) => {
  const [isMultiSortDialogOpen, setIsMultiSortDialogOpen] = useState(false);
  const [multiSortColumns, setMultiSortColumns] = useState<SortColumn[]>(currentSort.columns);

  const handleSingleColumnSort = (columnIndex: number, direction: SortDirection) => {
    const newSort: SortState = {
      columns: [{ column_index: columnIndex, direction }],
    };
    onSortChange(newSort);
  };

  const handleMultiSortApply = () => {
    const newSort: SortState = {
      columns: multiSortColumns.filter(col => col.column_index >= 0),
    };
    onSortChange(newSort);
    setIsMultiSortDialogOpen(false);
  };

  const addSortColumn = () => {
    setMultiSortColumns([
      ...multiSortColumns,
      { column_index: 0, direction: 'Ascending' },
    ]);
  };

  const removeSortColumn = (index: number) => {
    setMultiSortColumns(multiSortColumns.filter((_, i) => i !== index));
  };

  const updateSortColumn = (index: number, columnIndex: number, direction: SortDirection) => {
    const updated = [...multiSortColumns];
    updated[index] = { column_index: columnIndex, direction };
    setMultiSortColumns(updated);
  };

  const getSortIndicator = (columnIndex: number) => {
    const sortCol = currentSort.columns.find(col => col.column_index === columnIndex);
    if (!sortCol) return null;

    const priority = currentSort.columns.indexOf(sortCol);
    const isMultiple = currentSort.columns.length > 1;

    return (
      <span className="ml-1 inline-flex items-center">
        {sortCol.direction === 'Ascending' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        {isMultiple && (
          <span className="ml-1 text-xs">{priority + 1}</span>
        )}
      </span>
    );
  };

  const hasSortApplied = currentSort.columns.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 ${hasSortApplied ? 'bg-blue-50 text-blue-600' : ''}`}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Sort
            {hasSortApplied && (
              <span className="ml-1 text-xs bg-blue-600 text-white rounded-full px-1">
                {currentSort.columns.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {headers.map((header, index) => (
            <DropdownMenuSub key={index}>
              <DropdownMenuSubTrigger className="flex items-center justify-between">
                <span className="truncate">{header}</span>
                {getSortIndicator(index)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleSingleColumnSort(index, 'Ascending')}>
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Sort Ascending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSingleColumnSort(index, 'Descending')}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Sort Descending
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {
            setMultiSortColumns(currentSort.columns);
            setIsMultiSortDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Multi-column Sort
          </DropdownMenuItem>
          {hasSortApplied && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearSort} className="text-red-600">
                <X className="mr-2 h-4 w-4" />
                Clear Sort
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Multi-Sort Dialog */}
      <Dialog open={isMultiSortDialogOpen} onOpenChange={setIsMultiSortDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Multi-Column Sort</DialogTitle>
            <DialogDescription>
              Configure sorting for multiple columns. Columns are sorted in the order listed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {multiSortColumns.map((sortCol, index) => (
              <div key={index} className="flex items-center gap-2">
                <Label className="text-sm font-medium min-w-[20px]">
                  {index + 1}.
                </Label>
                <Select
                  value={sortCol.column_index.toString()}
                  onValueChange={(value) =>
                    updateSortColumn(index, parseInt(value), sortCol.direction)
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header, headerIndex) => (
                      <SelectItem key={headerIndex} value={headerIndex.toString()}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sortCol.direction}
                  onValueChange={(value: SortDirection) =>
                    updateSortColumn(index, sortCol.column_index, value)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ascending">
                      <div className="flex items-center">
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Asc
                      </div>
                    </SelectItem>
                    <SelectItem value="Descending">
                      <div className="flex items-center">
                        <ArrowDown className="mr-2 h-4 w-4" />
                        Desc
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSortColumn(index)}
                  className="p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addSortColumn}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Sort Column
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMultiSortDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMultiSortApply}>
              Apply Sort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};