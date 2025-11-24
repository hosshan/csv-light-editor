// ScriptPreview component for displaying Python script code
import { Code, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import type { Script } from '../../types/script';

interface ScriptPreviewProps {
  script: Script;
  onEdit?: () => void;
  onExecute?: () => void;
  showActions?: boolean;
}

export function ScriptPreview({
  script,
  onEdit,
  onExecute,
  showActions = true,
}: ScriptPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy script:', error);
    }
  };

  const isTransformation = script.scriptType === 'transformation';
  const isPending = script.executionState === 'pending';
  const isRunning = script.executionState === 'running';
  const isCompleted = script.executionState === 'completed';
  const isFailed = script.executionState === 'failed';

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium">Python Script</span>
          <Badge
            variant={
              isTransformation
                ? 'default'
                : isFailed
                ? 'destructive'
                : 'secondary'
            }
            className="text-xs"
          >
            {script.scriptType}
          </Badge>
          {isRunning && (
            <Badge variant="secondary" className="text-xs">
              Running...
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="default" className="text-xs bg-green-600">
              Completed
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="text-xs">
              Failed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2"
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Script content */}
      <div className="relative">
        <pre className="p-3 text-xs font-mono overflow-x-auto bg-muted/30 max-h-64 overflow-y-auto">
          <code>{script.content}</code>
        </pre>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-end gap-2 p-2 border-t bg-muted/30">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={isRunning}
            >
              Edit
            </Button>
          )}
          {onExecute && isPending && (
            <Button
              size="sm"
              onClick={onExecute}
              disabled={isRunning}
            >
              {isTransformation ? 'Approve & Execute' : 'Execute'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

