import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CsvData } from '@/types/csv';

interface DataTypeDetectionProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: CsvData;
  onValidate?: (errors: ValidationError[]) => void;
}

interface ColumnTypeInfo {
  column_index: number;
  column_name: string;
  detected_type: string;
  sample_values: string[];
}

interface ValidationError {
  row_index: number;
  column_index: number;
  value: string;
  expected_type: string;
  message: string;
}

interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

export const DataTypeDetection: React.FC<DataTypeDetectionProps> = ({
  isOpen,
  onClose,
  csvData,
  onValidate,
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [columnTypes, setColumnTypes] = useState<ColumnTypeInfo[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetectTypes = async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const types = await invoke<ColumnTypeInfo[]>('detect_column_types', {
        data: csvData,
      });
      setColumnTypes(types);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect column types');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleValidate = async () => {
    if (columnTypes.length === 0) {
      setError('Please detect column types first');
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const columnTypePairs = columnTypes.map(ct => [
        ct.column_index,
        ct.detected_type,
      ]);

      const result = await invoke<ValidationResult>('validate_data_types', {
        data: csvData,
        columnTypes: columnTypePairs,
      });

      setValidationResult(result);
      if (onValidate && result.errors.length > 0) {
        onValidate(result.errors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate data');
    } finally {
      setIsValidating(false);
    }
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      Integer: 'bg-blue-500',
      Float: 'bg-cyan-500',
      Boolean: 'bg-purple-500',
      Date: 'bg-green-500',
      DateTime: 'bg-emerald-500',
      Email: 'bg-orange-500',
      URL: 'bg-indigo-500',
      JSON: 'bg-yellow-500',
      Text: 'bg-gray-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Data Type Detection & Validation</DialogTitle>
          <DialogDescription>
            Analyze column data types and validate data consistency
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-1">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleDetectTypes}
              disabled={isDetecting || isValidating}
            >
              {isDetecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                'Detect Types'
              )}
            </Button>
            <Button
              onClick={handleValidate}
              disabled={isValidating || columnTypes.length === 0}
              variant="secondary"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate Data'
              )}
            </Button>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Column Types Table */}
          {columnTypes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Detected Column Types</h3>
              <div className="border rounded-md max-h-64 overflow-hidden">
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Column Name</TableHead>
                        <TableHead>Detected Type</TableHead>
                        <TableHead>Sample Values</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnTypes.map((column) => (
                        <TableRow key={column.column_index}>
                          <TableCell>{column.column_index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {column.column_name}
                          </TableCell>
                          <TableCell>
                            <Badge className={getTypeColor(column.detected_type)}>
                              {column.detected_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {column.sample_values.slice(0, 3).join(', ')}
                            {column.sample_values.length > 3 && '...'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Validation Results</h3>
              {validationResult.is_valid ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    All data is valid according to the detected types!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Found {validationResult.errors.length} validation error(s)
                    </AlertDescription>
                  </Alert>
                  <div className="border rounded-md max-h-64 overflow-hidden">
                    <ScrollArea className="h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Column</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Expected Type</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 100).map((error, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{error.row_index + 1}</TableCell>
                              <TableCell>
                                {columnTypes[error.column_index]?.column_name || error.column_index + 1}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {error.value}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{error.expected_type}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {error.message}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {validationResult.errors.length > 100 && (
                        <div className="p-2 text-center text-sm text-muted-foreground">
                          Showing first 100 errors of {validationResult.errors.length}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};