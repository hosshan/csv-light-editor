import React, { useMemo } from 'react';
import { useCsvStore } from '../store/csvStore';

interface StatisticsData {
  count: number;
  sum?: number;
  min?: number;
  max?: number;
  average?: number;
  hasNumericData: boolean;
}

export const SelectionStatistics: React.FC = () => {
  const { data, selectedCell, selectedRange } = useCsvStore();

  const statistics = useMemo((): StatisticsData | null => {
    if (!data) return null;

    let values: string[] = [];

    if (selectedCell) {
      // Single cell selected
      values = [selectedCell.value];
    } else if (selectedRange) {
      // Range selected
      for (let row = selectedRange.startRow; row <= selectedRange.endRow; row++) {
        for (let col = selectedRange.startColumn; col <= selectedRange.endColumn; col++) {
          const value = data.rows[row]?.[col] || '';
          values.push(value);
        }
      }
    } else {
      return null; // No selection
    }

    if (values.length === 0) return null;

    // Filter out empty values for statistics
    const nonEmptyValues = values.filter(v => v.trim() !== '');
    const count = nonEmptyValues.length;

    if (count === 0) {
      return { count: 0, hasNumericData: false };
    }

    // Try to parse as numbers
    const numericValues = nonEmptyValues
      .map(v => {
        // Remove common formatting characters and try to parse
        const cleaned = v.replace(/[,$%]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      })
      .filter((num): num is number => num !== null);

    const hasNumericData = numericValues.length > 0;

    if (!hasNumericData) {
      return { count, hasNumericData: false };
    }

    // Calculate numeric statistics
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const average = sum / numericValues.length;

    return {
      count,
      sum,
      min,
      max,
      average,
      hasNumericData: true
    };
  }, [data, selectedCell, selectedRange]);

  if (!statistics || statistics.count === 0) {
    return null;
  }

  const formatNumber = (num: number): string => {
    // Format numbers with appropriate precision
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    } else {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
  };

  return (
    <div className="bg-muted/50 border-t border-border px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-6">
        <span className="font-medium">
          アイテム数: {statistics.count.toLocaleString()}
        </span>

        {statistics.hasNumericData && (
          <>
            <span>
              合計: {formatNumber(statistics.sum!)}
            </span>
            <span>
              最小: {formatNumber(statistics.min!)}
            </span>
            <span>
              最大: {formatNumber(statistics.max!)}
            </span>
            <span>
              平均: {formatNumber(statistics.average!)}
            </span>
          </>
        )}

        {!statistics.hasNumericData && statistics.count > 1 && (
          <span className="text-muted-foreground/70">
            (数値データなし)
          </span>
        )}
      </div>
    </div>
  );
};