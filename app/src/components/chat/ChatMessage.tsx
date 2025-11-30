// ChatMessage component for displaying individual messages
import { memo } from 'react';
import { Bot, User, XCircle, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../../types/chat';
import { ScriptPreview } from './ScriptPreview';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessage;
}

export const ChatMessageComponent = memo(function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.metadata?.messageType === 'error';
  const isAnalysis = message.metadata?.messageType === 'analysis';
  const isTransformation = message.metadata?.messageType === 'transformation';
  const isProgress = message.metadata?.messageType === 'progress';

  return (
    <div
      className={cn(
        'flex items-start gap-3 mb-4',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isError
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : isError ? (
          <XCircle className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex-1 min-w-0', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block max-w-[85%] p-3 rounded-lg min-w-0',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isError
              ? 'bg-destructive/10 text-destructive border border-destructive/20'
              : 'bg-muted'
          )}
        >
          {/* Message type badge */}
          {!isUser && message.metadata?.messageType && (
            <div className="mb-2">
              <Badge
                variant={
                  isError
                    ? 'destructive'
                    : isTransformation
                    ? 'default'
                    : 'secondary'
                }
                className="text-xs"
              >
                {isError && <XCircle className="w-3 h-3 mr-1" />}
                {isAnalysis && 'Analysis'}
                {isTransformation && 'Transformation'}
                {isProgress && (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Processing
                  </>
                )}
                {isError && 'Error'}
              </Badge>
            </div>
          )}

          {/* Message text */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Script preview */}
          {message.script && (
            <div className="mt-3 w-full max-w-full min-w-0 overflow-hidden">
              <ScriptPreview script={message.script} />
            </div>
          )}

          {/* Analysis details */}
          {isAnalysis && message.metadata?.data && (
            <div className="mt-3 space-y-3 text-xs">
              {/* Summary section */}
              {message.metadata.data.summary && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                  <div className="font-semibold mb-1 text-xs text-blue-900 dark:text-blue-100">要約</div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {typeof message.metadata.data.summary === 'string' 
                      ? message.metadata.data.summary 
                      : JSON.stringify(message.metadata.data.summary, null, 2)}
                  </p>
                </div>
              )}

              {/* Details section - formatted display */}
              {message.metadata.data.details && (
                <div className="bg-background/50 p-3 rounded border">
                  <div className="font-semibold mb-2 text-sm">詳細結果</div>
                  {typeof message.metadata.data.details === 'object' && message.metadata.data.details !== null && !Array.isArray(message.metadata.data.details) ? (
                    <div className="space-y-2">
                      {Object.entries(message.metadata.data.details).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                          <span className="font-medium">{key}:</span>
                          <span className="text-muted-foreground ml-2">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="overflow-x-auto text-[10px] font-mono">
                      {JSON.stringify(message.metadata.data.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              
              {/* Raw output section - Python execution result */}
              <details className="bg-muted/30 p-2 rounded border">
                <summary className="cursor-pointer font-semibold text-xs mb-2 hover:text-foreground select-none">
                  Python実行結果（JSON形式）
                </summary>
                <pre className="overflow-x-auto text-[10px] font-mono mt-2 p-2 bg-background/50 rounded max-h-64 overflow-y-auto">
                  {JSON.stringify(message.metadata.data, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Transformation preview */}
          {isTransformation && message.metadata?.data?.preview && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold">
                Preview (showing first {message.metadata.data.preview?.length || 0} changes):
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {message.metadata.data.preview?.slice(0, 10).map((change: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-background/50 p-2 rounded text-xs"
                  >
                    <div className="font-mono text-[10px] text-muted-foreground mb-1">
                      Row {change.rowIndex + 1}, {change.columnName}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="line-through text-destructive flex-1 truncate">
                        {change.oldValue || '(empty)'}
                      </span>
                      <span>→</span>
                      <span className="text-green-600 flex-1 truncate">
                        {change.newValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
});

