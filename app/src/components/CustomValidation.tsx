import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { CsvData } from '@/types/csv';

interface CustomValidationProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: CsvData;
}

interface ValidationRule {
  rule_type: 'range' | 'length' | 'pattern' | 'required' | 'unique';
  column_index: number;
  column_name: string;
  parameters: Record<string, string>;
  error_message?: string;
}

interface ValidationError {
  row_index: number;
  column_index: number;
  column_name: string;
  value: string;
  rule_type: string;
  message: string;
}

export const CustomValidation: React.FC<CustomValidationProps> = ({
  isOpen,
  onClose,
  csvData,
}) => {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New rule form state
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [ruleType, setRuleType] = useState<ValidationRule['rule_type']>('required');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [pattern, setPattern] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAddRule = () => {
    const parameters: Record<string, string> = {};

    switch (ruleType) {
      case 'range':
        if (minValue) parameters.min = minValue;
        if (maxValue) parameters.max = maxValue;
        break;
      case 'length':
        if (minLength) parameters.min_length = minLength;
        if (maxLength) parameters.max_length = maxLength;
        break;
      case 'pattern':
        if (pattern) parameters.pattern = pattern;
        break;
    }

    const newRule: ValidationRule = {
      rule_type: ruleType,
      column_index: selectedColumn,
      column_name: csvData.headers[selectedColumn] || `Column ${selectedColumn}`,
      parameters,
      error_message: errorMessage || undefined,
    };

    setRules([...rules, newRule]);

    // Reset form
    setMinValue('');
    setMaxValue('');
    setMinLength('');
    setMaxLength('');
    setPattern('');
    setErrorMessage('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    if (rules.length === 0) {
      setError('Please add at least one validation rule');
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const validationErrors = await invoke<ValidationError[]>('validate_with_rules', {
        data: csvData,
        rules: rules,
      });
      setErrors(validationErrors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate data');
    } finally {
      setIsValidating(false);
    }
  };

  const getRuleTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      range: 'Range',
      length: 'Length',
      pattern: 'Pattern',
      required: 'Required',
      unique: 'Unique',
    };
    return labels[type] || type;
  };

  const getRuleDescription = (rule: ValidationRule): string => {
    switch (rule.rule_type) {
      case 'range':
        return `${rule.parameters.min || '∞'} - ${rule.parameters.max || '∞'}`;
      case 'length':
        return `${rule.parameters.min_length || '0'} - ${rule.parameters.max_length || '∞'} chars`;
      case 'pattern':
        return rule.parameters.pattern || '';
      case 'required':
        return 'Must not be empty';
      case 'unique':
        return 'Must be unique';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Custom Validation Rules</DialogTitle>
          <DialogDescription>
            Define custom validation rules for your data columns
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-1">
            {/* Add Rule Form */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold">Add Validation Rule</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Column</Label>
                  <Select
                    value={selectedColumn.toString()}
                    onValueChange={(v) => setSelectedColumn(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {csvData.headers.map((header, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select
                    value={ruleType}
                    onValueChange={(v) => setRuleType(v as ValidationRule['rule_type'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="unique">Unique</SelectItem>
                      <SelectItem value="range">Range (numeric)</SelectItem>
                      <SelectItem value="length">Length</SelectItem>
                      <SelectItem value="pattern">Pattern (regex)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rule-specific parameters */}
              {ruleType === 'range' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Value</Label>
                    <Input
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      placeholder="Minimum"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Value</Label>
                    <Input
                      type="number"
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                      placeholder="Maximum"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'length' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Length</Label>
                    <Input
                      type="number"
                      value={minLength}
                      onChange={(e) => setMinLength(e.target.value)}
                      placeholder="Minimum length"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Length</Label>
                    <Input
                      type="number"
                      value={maxLength}
                      onChange={(e) => setMaxLength(e.target.value)}
                      placeholder="Maximum length"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'pattern' && (
                <div className="space-y-2">
                  <Label>Regular Expression Pattern</Label>
                  <Input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g., ^[A-Z]{3}-\d{4}$"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Custom Error Message (optional)</Label>
                <Input
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="Enter custom error message"
                />
              </div>

              <Button onClick={handleAddRule} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </div>

            {/* Current Rules */}
            {rules.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Current Rules ({rules.length})</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Constraint</TableHead>
                        <TableHead>Error Message</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{rule.column_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getRuleTypeLabel(rule.rule_type)}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{getRuleDescription(rule)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {rule.error_message || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRule(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Validate Button */}
            <Button
              onClick={handleValidate}
              disabled={isValidating || rules.length === 0}
              className="w-full"
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

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Validation Results */}
            {errors !== null && errors.length === 0 && !isValidating && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All data passed validation! No errors found.
                </AlertDescription>
              </Alert>
            )}

            {errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Validation Errors ({errors.length})
                </h3>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Found {errors.length} validation error(s)
                  </AlertDescription>
                </Alert>
                <div className="border rounded-md">
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Column</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Rule</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.slice(0, 100).map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{err.row_index + 1}</TableCell>
                            <TableCell>{err.column_name}</TableCell>
                            <TableCell className="font-mono text-xs">{err.value}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{getRuleTypeLabel(err.rule_type)}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {errors.length > 100 && (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Showing first 100 errors of {errors.length}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
