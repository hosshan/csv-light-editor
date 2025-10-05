import { FilterConfig } from '../types/csv';

export function applyFilter(cellValue: string, filter: FilterConfig): boolean {
  const { operator, value, value2, dataType } = filter;

  // Handle empty/not empty operators first
  if (operator === 'isEmpty') {
    return cellValue.trim() === '';
  }
  if (operator === 'isNotEmpty') {
    return cellValue.trim() !== '';
  }

  // For other operators, we need a value
  if (!value && value !== '0') {
    return true; // If no filter value is set, don't filter anything
  }

  // Apply data type conversion

  if (dataType === 'number') {
    const numCellValue = parseFloat(cellValue);
    const numFilterValue = parseFloat(value);
    const numFilterValue2 = value2 ? parseFloat(value2) : undefined;

    // If either value is NaN, handle as text comparison
    if (isNaN(numCellValue) || isNaN(numFilterValue)) {
      return applyTextFilter(cellValue, operator, value);
    }

    return applyNumberFilter(numCellValue, operator, numFilterValue, numFilterValue2);
  }

  if (dataType === 'date') {
    const dateCellValue = new Date(cellValue);
    const dateFilterValue = new Date(value);
    const dateFilterValue2 = value2 ? new Date(value2) : undefined;

    // If either value is invalid date, handle as text comparison
    if (isNaN(dateCellValue.getTime()) || isNaN(dateFilterValue.getTime())) {
      return applyTextFilter(cellValue, operator, value);
    }

    return applyDateFilter(dateCellValue, operator, dateFilterValue, dateFilterValue2);
  }

  // Default to text filtering
  return applyTextFilter(cellValue, operator, value);
}

function applyTextFilter(cellValue: string, operator: FilterConfig['operator'], filterValue: string): boolean {
  const cellLower = cellValue.toLowerCase();
  const filterLower = filterValue.toLowerCase();

  switch (operator) {
    case 'equals':
      return cellValue === filterValue;
    case 'contains':
      return cellLower.includes(filterLower);
    case 'startsWith':
      return cellLower.startsWith(filterLower);
    case 'endsWith':
      return cellLower.endsWith(filterLower);
    case 'regex':
      try {
        const regex = new RegExp(filterValue, 'i');
        return regex.test(cellValue);
      } catch {
        // If regex is invalid, fall back to contains
        return cellLower.includes(filterLower);
      }
    default:
      return true;
  }
}

function applyNumberFilter(
  cellValue: number,
  operator: FilterConfig['operator'],
  filterValue: number,
  filterValue2?: number
): boolean {
  switch (operator) {
    case 'equals':
      return cellValue === filterValue;
    case 'greater':
      return cellValue > filterValue;
    case 'less':
      return cellValue < filterValue;
    case 'greaterOrEqual':
      return cellValue >= filterValue;
    case 'lessOrEqual':
      return cellValue <= filterValue;
    case 'between':
      if (filterValue2 === undefined) return true;
      const min = Math.min(filterValue, filterValue2);
      const max = Math.max(filterValue, filterValue2);
      return cellValue >= min && cellValue <= max;
    default:
      return true;
  }
}

function applyDateFilter(
  cellValue: Date,
  operator: FilterConfig['operator'],
  filterValue: Date,
  filterValue2?: Date
): boolean {
  switch (operator) {
    case 'equals':
      return cellValue.toDateString() === filterValue.toDateString();
    case 'dateAfter':
      return cellValue > filterValue;
    case 'dateBefore':
      return cellValue < filterValue;
    case 'dateRange':
      if (!filterValue2) return true;
      const minDate = filterValue < filterValue2 ? filterValue : filterValue2;
      const maxDate = filterValue > filterValue2 ? filterValue : filterValue2;
      return cellValue >= minDate && cellValue <= maxDate;
    default:
      return true;
  }
}