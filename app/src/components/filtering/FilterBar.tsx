import { Plus, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import { FilterConfig } from '../../types/csv';
import { FilterRow } from './FilterRow';

interface FilterBarProps {
  filters: FilterConfig[];
  headers: string[];
  onAddFilter: () => void;
  onUpdateFilter: (id: string, updates: Partial<FilterConfig>) => void;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  headers,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearAll
}: FilterBarProps) {
  const activeFilters = filters.filter(f => f.isActive);
  const hasFilters = filters.length > 0;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="flex items-center gap-2 p-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filters</span>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddFilter}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Filter
        </Button>

        {hasFilters && (
          <>
            <span className="text-xs text-muted-foreground">
              {activeFilters.length} of {filters.length} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          </>
        )}
      </div>

      {hasFilters && (
        <div className="px-2 pb-2 space-y-1">
          {filters.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              headers={headers}
              onUpdate={(updates) => onUpdateFilter(filter.id, updates)}
              onRemove={() => onRemoveFilter(filter.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}