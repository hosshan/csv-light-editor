import { X, Calendar, Hash, Type } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { FilterConfig } from '../../types/csv';

interface FilterRowProps {
  filter: FilterConfig;
  headers: string[];
  onUpdate: (updates: Partial<FilterConfig>) => void;
  onRemove: () => void;
}

const operatorOptions = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'startsWith', label: 'Starts with' },
    { value: 'endsWith', label: 'Ends with' },
    { value: 'isEmpty', label: 'Is empty' },
    { value: 'isNotEmpty', label: 'Is not empty' },
    { value: 'regex', label: 'Regex' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater', label: 'Greater than' },
    { value: 'less', label: 'Less than' },
    { value: 'greaterOrEqual', label: 'Greater or equal' },
    { value: 'lessOrEqual', label: 'Less or equal' },
    { value: 'between', label: 'Between' },
    { value: 'isEmpty', label: 'Is empty' },
    { value: 'isNotEmpty', label: 'Is not empty' },
  ],
  date: [
    { value: 'equals', label: 'Equals' },
    { value: 'dateAfter', label: 'After' },
    { value: 'dateBefore', label: 'Before' },
    { value: 'dateRange', label: 'Between' },
    { value: 'isEmpty', label: 'Is empty' },
    { value: 'isNotEmpty', label: 'Is not empty' },
  ],
};

const dataTypeIcons = {
  text: Type,
  number: Hash,
  date: Calendar,
};

export function FilterRow({ filter, headers, onUpdate, onRemove }: FilterRowProps) {
  const dataType = filter.dataType || 'text';
  const Icon = dataTypeIcons[dataType];
  const availableOperators = operatorOptions[dataType];

  const requiresValue = !['isEmpty', 'isNotEmpty'].includes(filter.operator);
  const requiresSecondValue = ['between', 'dateRange'].includes(filter.operator);

  const handleColumnChange = (value: string) => {
    onUpdate({ column: parseInt(value) });
  };

  const handleDataTypeChange = (value: string) => {
    const newDataType = value as 'text' | 'number' | 'date';
    // Reset operator when data type changes
    const defaultOperator = operatorOptions[newDataType][0].value;
    onUpdate({
      dataType: newDataType,
      operator: defaultOperator as FilterConfig['operator']
    });
  };

  const handleOperatorChange = (value: string) => {
    onUpdate({ operator: value as FilterConfig['operator'] });
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      <Checkbox
        checked={filter.isActive}
        onCheckedChange={(checked) => onUpdate({ isActive: !!checked })}
      />

      <Icon className="h-4 w-4 text-muted-foreground" />

      <Select value={filter.column.toString()} onValueChange={handleColumnChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((header, index) => (
            <SelectItem key={index} value={index.toString()}>
              {header || `Column ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={dataType} onValueChange={handleDataTypeChange}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text</SelectItem>
          <SelectItem value="number">Number</SelectItem>
          <SelectItem value="date">Date</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filter.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {requiresValue && (
        <Input
          placeholder="Value"
          value={filter.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="w-32"
          type={dataType === 'number' ? 'number' : dataType === 'date' ? 'date' : 'text'}
        />
      )}

      {requiresSecondValue && (
        <Input
          placeholder="To"
          value={filter.value2 || ''}
          onChange={(e) => onUpdate({ value2: e.target.value })}
          className="w-32"
          type={dataType === 'number' ? 'number' : dataType === 'date' ? 'date' : 'text'}
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}