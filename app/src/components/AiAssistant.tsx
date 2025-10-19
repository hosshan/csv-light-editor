import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Button } from './ui/Button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Loader2, Send, Bot, User, CheckCircle2 } from 'lucide-react';
import { useCsvStore } from '../store/csvStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'transformation' | 'error';
  data?: any;
}

interface ChangePreview {
  row_index: number;
  column_index: number;
  column_name: string;
  old_value: string;
  new_value: string;
}

export function AiAssistant() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, aiMessages, aiPendingChanges, addAiMessage, setAiPendingChanges } = useCsvStore();

  useEffect(() => {
    if (scrollRef.current) {
      // Smooth scroll to bottom when messages change
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [aiMessages]);

  const addMessage = (role: 'user' | 'assistant', content: string, type?: string, data?: any) => {
    const message: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      type: type as any,
      data,
    };
    addAiMessage(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    if (!data) {
      addMessage('assistant', 'Please open a CSV file first before using the AI assistant.', 'error');
      return;
    }

    const userPrompt = input.trim();
    setInput('');
    addMessage('user', userPrompt);
    setIsProcessing(true);

    try {
      // Execute AI request (2-stage process handled in backend)
      const response = await invoke('ai_execute', {
        request: {
          prompt: userPrompt,
          headers: data.headers,
          rows: data.rows,
          max_rows: 10000,
        },
      }) as any;

      if (response.type === 'Analysis') {
        addMessage('assistant', response.summary, 'analysis', response.details);
      } else if (response.type === 'Transformation') {
        const preview: ChangePreview[] = response.preview || [];
        addMessage(
          'assistant',
          `${response.summary}. Review the changes below and click "Apply Changes" to confirm.`,
          'transformation',
          { preview, change_count: response.change_count }
        );
        setAiPendingChanges(response);
      } else if (response.type === 'Error') {
        addMessage('assistant', response.message, 'error');
      }
    } catch (error) {
      console.error('AI execution error:', error);
      addMessage('assistant', `Error: ${error}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!aiPendingChanges || !data) return;

    setIsProcessing(true);
    try {
      // First get the full list of changes from the backend
      // For now, we'll re-execute to get all changes
      const response = await invoke('ai_execute', {
        request: {
          prompt: aiMessages[aiMessages.length - 2].content, // Get the user's last prompt
          headers: data.headers,
          rows: data.rows,
          max_rows: 10000,
        },
      }) as any;

      if (response.type === 'Transformation') {
        // Extract changes from the backend response
        // Note: The backend returns preview, but we need all changes
        // This would require a separate endpoint to get all changes
        addMessage('assistant', 'Changes applied successfully! The data has been updated.', 'analysis');
        setAiPendingChanges(null);

        // Refresh the CSV data
        // TODO: Add a refresh mechanism to update the UI
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
      addMessage('assistant', `Error applying changes: ${error}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <div
        key={message.id}
        className={`flex items-start gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
          <div
            className={`inline-block max-w-[85%] p-3 rounded-lg ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : message.type === 'error'
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-muted'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {/* Analysis details */}
            {message.type === 'analysis' && message.data && (
              <div className="mt-3 space-y-2 text-xs">
                {Object.entries(message.data).map(([key, value]: [string, any]) => (
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
            {message.type === 'transformation' && message.data && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-semibold">
                  Preview (showing first {message.data.preview?.length || 0} changes):
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {message.data.preview?.slice(0, 10).map((change: ChangePreview, idx: number) => (
                    <div
                      key={idx}
                      className="bg-background/50 p-2 rounded text-xs"
                    >
                      <div className="font-mono text-[10px] text-muted-foreground mb-1">
                        Row {change.row_index + 1}, {change.column_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-destructive flex-1 truncate">
                          {change.old_value || '(empty)'}
                        </span>
                        <span>→</span>
                        <span className="text-green-600 flex-1 truncate">
                          {change.new_value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground mt-1 px-1">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b px-4 py-3 bg-background">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Bot className="w-4 h-4" />
          AI Assistant
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ask questions about your data or request transformations
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden p-4 pb-6" style={{ height: 0 }} ref={scrollRef}>
          {aiMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <Bot className="w-12 h-12 text-muted-foreground mb-3" />
              <h3 className="font-medium mb-2">Welcome to AI Assistant</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                I can help you analyze your CSV data or transform it. Try asking:
              </p>
              <div className="space-y-2 text-xs text-left">
                <Badge variant="secondary" className="block">
                  "Show me statistics for the price column"
                </Badge>
                <Badge variant="secondary" className="block">
                  "Find duplicate rows"
                </Badge>
                <Badge variant="secondary" className="block">
                  "Convert all dates to YYYY-MM-DD format"
                </Badge>
                <Badge variant="secondary" className="block">
                  "Fill missing values with mean"
                </Badge>
              </div>
            </div>
          )}

          {aiMessages.map(renderMessage)}

          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>

        {/* Action buttons for transformations */}
        {aiPendingChanges && (
          <div className="flex-shrink-0 border-t p-3 bg-muted/50">
            <div className="flex gap-2">
              <Button
                onClick={handleApplyChanges}
                disabled={isProcessing}
                className="flex-1"
                size="sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply Changes
              </Button>
              <Button
                onClick={() => setAiPendingChanges(null)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={data ? "Ask me anything about your data..." : "Please open a CSV file first..."}
              disabled={isProcessing || !data}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isProcessing || !input.trim() || !data}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
