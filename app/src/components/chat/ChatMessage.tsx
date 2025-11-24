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
      <div className={cn('flex-1', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block max-w-[85%] p-3 rounded-lg',
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
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {/* Script preview */}
          {message.script && (
            <div className="mt-3">
              <ScriptPreview script={message.script} />
            </div>
          )}

          {/* Analysis details */}
          {isAnalysis && message.metadata?.data && (
            <div className="mt-3 space-y-2 text-xs">
              {Object.entries(message.metadata.data).map(([key, value]: [string, any]) => (
                <div key={key} className="bg-background/50 p-2 rounded">
                  <div className="font-semibold mb-1">{key}</div>
                  <pre className="overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
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

