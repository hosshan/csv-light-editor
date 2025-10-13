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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2, TrendingDown, Copy, AlertTriangle } from 'lucide-react';
import type { CsvData } from '@/types/csv';

interface DataQualityProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: CsvData;
  onApplyCleansing?: (result: CleansingResult) => void;
}

interface QualityReport {
  total_rows: number;
  total_columns: number;
  completeness: number;
  column_reports: ColumnQualityReport[];
  duplicates: DuplicateReport;
  outliers: OutlierReport;
}

interface ColumnQualityReport {
  column_index: number;
  column_name: string;
  total_values: number;
  empty_count: number;
  unique_count: number;
  completeness: number;
  uniqueness: number;
  data_type_consistency: number;
  dominant_type: string;
}

interface DuplicateReport {
  total_duplicates: number;
  duplicate_rows: DuplicateRow[];
}

interface DuplicateRow {
  row_indices: number[];
  count: number;
}

interface OutlierReport {
  total_outliers: number;
  outlier_details: OutlierDetail[];
}

interface OutlierDetail {
  row_index: number;
  column_index: number;
  column_name: string;
  value: string;
  z_score: number;
  method: string;
}

interface CleansingResult {
  rows_affected: number;
  cells_modified: number;
  modifications: ModificationDetail[];
}

interface ModificationDetail {
  row_index: number;
  column_index: number;
  old_value: string;
  new_value: string;
}

export const DataQuality: React.FC<DataQualityProps> = ({
  isOpen,
  onClose,
  csvData,
  onApplyCleansing,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleansing, setIsCleansing] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const qualityReport = await invoke<QualityReport>('generate_quality_report', {
        data: csvData,
      });
      setReport(qualityReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quality report');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    setIsCleansing(true);
    setError(null);
    try {
      const [, result] = await invoke<[CsvData, CleansingResult]>('cleanse_data', {
        data: csvData,
        options: {
          action: 'removeduplicates',
          column_indices: null,
          parameters: {},
        },
      });

      if (onApplyCleansing) {
        onApplyCleansing(result);
      }

      // Re-analyze after cleansing
      await handleAnalyze();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove duplicates');
    } finally {
      setIsCleansing(false);
    }
  };

  const handleRemoveOutliers = async () => {
    setIsCleansing(true);
    setError(null);
    try {
      const [, result] = await invoke<[CsvData, CleansingResult]>('cleanse_data', {
        data: csvData,
        options: {
          action: 'removeoutliers',
          column_indices: null,
          parameters: {},
        },
      });

      if (onApplyCleansing) {
        onApplyCleansing(result);
      }

      // Re-analyze after cleansing
      await handleAnalyze();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove outliers');
    } finally {
      setIsCleansing(false);
    }
  };

  const getQualityColor = (value: number): string => {
    if (value >= 0.9) return 'text-green-600';
    if (value >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Data Quality Analysis</DialogTitle>
          <DialogDescription>
            Comprehensive data quality report with cleansing recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-1">
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isCleansing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Quality'
                )}
              </Button>
              {report && (
                <>
                  {report.duplicates.total_duplicates > 0 && (
                    <Button
                      onClick={handleRemoveDuplicates}
                      disabled={isCleansing}
                      variant="destructive"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Remove {report.duplicates.total_duplicates} Duplicates
                    </Button>
                  )}
                  {report.outliers.total_outliers > 0 && (
                    <Button
                      onClick={handleRemoveOutliers}
                      disabled={isCleansing}
                      variant="destructive"
                    >
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Remove {report.outliers.total_outliers} Outliers
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Quality Report */}
            {report && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="columns">Column Quality</TabsTrigger>
                  <TabsTrigger value="duplicates">
                    Duplicates {report.duplicates.total_duplicates > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {report.duplicates.total_duplicates}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="outliers">
                    Outliers {report.outliers.total_outliers > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {report.outliers.total_outliers}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Total Rows</div>
                      <div className="text-2xl font-bold">{report.total_rows.toLocaleString()}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Total Columns</div>
                      <div className="text-2xl font-bold">{report.total_columns}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Data Completeness</div>
                      <div className={`text-2xl font-bold ${getQualityColor(report.completeness)}`}>
                        {formatPercentage(report.completeness)}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Quality Score</div>
                      <div className={`text-2xl font-bold ${getQualityColor(report.completeness)}`}>
                        {report.completeness >= 0.9 ? 'Excellent' : report.completeness >= 0.7 ? 'Good' : 'Poor'}
                      </div>
                    </div>
                  </div>

                  {/* Quick Issues Summary */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Issues Found</h3>
                    {report.duplicates.total_duplicates === 0 && report.outliers.total_outliers === 0 && (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          No data quality issues detected! Your data looks clean.
                        </AlertDescription>
                      </Alert>
                    )}
                    {report.duplicates.total_duplicates > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Found {report.duplicates.total_duplicates} duplicate rows
                        </AlertDescription>
                      </Alert>
                    )}
                    {report.outliers.total_outliers > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Found {report.outliers.total_outliers} statistical outliers
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TabsContent>

                {/* Column Quality Tab */}
                <TabsContent value="columns">
                  <div className="border rounded-md">
                    <ScrollArea className="h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Completeness</TableHead>
                            <TableHead>Uniqueness</TableHead>
                            <TableHead>Consistency</TableHead>
                            <TableHead>Empty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.column_reports.map((col) => (
                            <TableRow key={col.column_index}>
                              <TableCell className="font-medium">{col.column_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{col.dominant_type}</Badge>
                              </TableCell>
                              <TableCell className={getQualityColor(col.completeness)}>
                                {formatPercentage(col.completeness)}
                              </TableCell>
                              <TableCell>{formatPercentage(col.uniqueness)}</TableCell>
                              <TableCell className={getQualityColor(col.data_type_consistency)}>
                                {formatPercentage(col.data_type_consistency)}
                              </TableCell>
                              <TableCell>{col.empty_count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Duplicates Tab */}
                <TabsContent value="duplicates">
                  {report.duplicates.total_duplicates === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>No duplicate rows found!</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border rounded-md">
                      <ScrollArea className="h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row Indices</TableHead>
                              <TableHead>Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.duplicates.duplicate_rows.slice(0, 100).map((dup, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">
                                  {dup.row_indices.slice(0, 5).map(i => i + 1).join(', ')}
                                  {dup.row_indices.length > 5 && '...'}
                                </TableCell>
                                <TableCell>{dup.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>

                {/* Outliers Tab */}
                <TabsContent value="outliers">
                  {report.outliers.total_outliers === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>No outliers detected!</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border rounded-md">
                      <ScrollArea className="h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Column</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Z-Score</TableHead>
                              <TableHead>Method</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.outliers.outlier_details.slice(0, 100).map((outlier, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{outlier.row_index + 1}</TableCell>
                                <TableCell>{outlier.column_name}</TableCell>
                                <TableCell className="font-mono text-xs">{outlier.value}</TableCell>
                                <TableCell>{outlier.z_score.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{outlier.method}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
