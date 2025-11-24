// ProgressIndicator component for displaying script execution progress
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import type { ExecutionProgress } from '../../types/script';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  progress: ExecutionProgress;
  className?: string;
}

export function ProgressIndicator({ progress, className }: ProgressIndicatorProps) {
  const isCompleted = progress.progressPercentage >= 100.0;
  const isError = false; // TODO: Add error state to ExecutionProgress

  const formatTime = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className={cn('space-y-2 p-3 bg-muted/50 rounded-lg border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : isError ? (
            <XCircle className="w-4 h-4 text-destructive" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">
            {isCompleted ? 'Completed' : isError ? 'Failed' : 'Processing'}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {progress.progressPercentage.toFixed(1)}%
        </Badge>
      </div>

      {/* Progress bar */}
      <Progress value={progress.progressPercentage} className="h-2" />

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{progress.currentStep}</span>
        <span>
          {progress.processedRows} / {progress.totalRows} rows
        </span>
      </div>

      {/* Estimated time */}
      {progress.estimatedRemainingSeconds && !isCompleted && (
        <div className="text-xs text-muted-foreground text-right">
          Estimated time remaining: {formatTime(progress.estimatedRemainingSeconds)}
        </div>
      )}
    </div>
  );
}

