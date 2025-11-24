// ChatPanel component - main chat interface for AI assistant
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { Bot, Send, Loader2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ChatMessageComponent } from './ChatMessage';
import { ProgressIndicator } from './ProgressIndicator';
import { useChatStore } from '../../store/chatStore';
import { useCsvStore } from '../../store/csvStore';
import type { ChatMessage, ChatHistory } from '../../types/chat';
import type { Script, ExecutionProgress } from '../../types/script';

interface ChatPanelProps {
  onClose?: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    executionProgress,
    isExecuting,
    addMessage,
    setExecutionProgress,
    setIsExecuting,
  } = useChatStore();
  
  const { data, currentFilePath } = useCsvStore();
  const { setCurrentHistory, setMessages } = useChatStore();

  // Load chat history when file changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!currentFilePath) {
        setMessages([]);
        setCurrentHistory(null);
        return;
      }

      try {
        const response = await invoke('load_chat_history', {
          csvPath: currentFilePath,
        }) as { history: ChatHistory | null };

        if (response.history) {
          setCurrentHistory(response.history);
          setMessages(response.history.messages);
        } else {
          setCurrentHistory(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Error recovery: continue with empty history instead of failing
        setCurrentHistory(null);
        setMessages([]);
        // Optionally show a non-intrusive notification
        // (we'll skip showing error to avoid disrupting user experience)
      }
    };

    loadChatHistory();
  }, [currentFilePath, setCurrentHistory, setMessages]);

  // Auto-scroll to bottom when messages change (optimized)
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, executionProgress, scrollToBottom]);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<ExecutionProgress>('script-progress', (event) => {
      setExecutionProgress(event.payload);
      setIsExecuting(true);
      
      // Update progress message
      const progressMessage: ChatMessage = {
        id: `progress-${event.payload.executionId}`,
        role: 'assistant',
        content: `Processing: ${event.payload.currentStep}`,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: 'progress',
          data: event.payload,
        },
      };
      
      // Update or add progress message
      const existingIndex = messages.findIndex(
        (m) => m.id === `progress-${event.payload.executionId}`
      );
      if (existingIndex >= 0) {
        // Update existing progress message
        const updatedMessages = [...messages];
        updatedMessages[existingIndex] = progressMessage;
        useChatStore.getState().setMessages(updatedMessages);
      } else {
        addMessage(progressMessage);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [messages, addMessage, setExecutionProgress, setIsExecuting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }
    
    if (trimmedInput.length > 2000) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Input is too long. Please keep your prompt under 2000 characters.',
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: 'error',
        },
      };
      addMessage(errorMessage);
      return;
    }
    
    if (isGenerating || isExecuting || !data) {
      return;
    }

    const userPrompt = trimmedInput;
    setInput('');
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);
    
    setIsGenerating(true);

    try {
      // Generate script
      const generateResponse = await invoke('generate_script', {
        prompt: userPrompt,
        csvContext: {
          csvPath: currentFilePath || undefined,
          headers: data.headers,
          rowCount: data.rows.length,
        },
      }) as any;

      const script: Script = {
        id: generateResponse.script.id,
        content: generateResponse.script.content,
        scriptType: generateResponse.script_type as 'analysis' | 'transformation',
        generatedAt: generateResponse.script.generated_at,
        userPrompt: generateResponse.script.user_prompt,
        executionState: 'pending',
      };

      // Add assistant message with script
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: generateResponse.script_type === 'transformation'
          ? 'I\'ve generated a transformation script. Please review it and approve to execute.'
          : 'I\'ve generated an analysis script. It will be executed automatically.',
        timestamp: new Date().toISOString(),
        script,
        metadata: {
          messageType: generateResponse.script_type === 'transformation' ? 'transformation' : 'analysis',
        },
      };
      addMessage(assistantMessage);

      // Auto-execute analysis scripts
      if (generateResponse.script_type === 'analysis') {
        await handleExecuteScript(script, false);
      } else {
        // For transformation, set pending script
        useChatStore.getState().setPendingScript(script);
      }
    } catch (error) {
      console.error('Failed to generate script:', error);
      
      // Improve error message based on error type
      let errorMessageText = 'Failed to generate script. ';
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('api key') || errorStr.includes('authentication')) {
          errorMessageText += 'Please check your API key configuration in settings.';
        } else if (errorStr.includes('network') || errorStr.includes('fetch')) {
          errorMessageText += 'Network error. Please check your internet connection.';
        } else if (errorStr.includes('timeout')) {
          errorMessageText += 'Request timed out. Please try again.';
        } else if (errorStr.includes('rate limit')) {
          errorMessageText += 'Rate limit exceeded. Please wait a moment and try again.';
        } else {
          errorMessageText += error.message;
        }
      } else {
        errorMessageText += String(error);
      }
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMessageText,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: 'error',
        },
      };
      addMessage(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteScript = async (script: Script, approval: boolean) => {
    if (!data) return;

    setIsExecuting(true);
    useChatStore.getState().setPendingScript(null);

    try {
      const executeResponse = await invoke('execute_script', {
        script: {
          id: script.id,
          content: script.content,
          script_type: script.scriptType,
          generated_at: script.generatedAt,
          user_prompt: script.userPrompt,
        },
        approval,
        csvData: {
          headers: data.headers,
          rows: data.rows,
        },
      }) as any;

      // Update script execution state
      const updatedScript: Script = {
        ...script,
        executionState: 'completed',
        executionResult: {
          executionId: executeResponse.execution_id,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: executeResponse.result,
        },
      };

      // Add result message
      const resultMessage: ChatMessage = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: executeResponse.result.type === 'analysis'
          ? executeResponse.result.summary
          : 'Transformation completed successfully!',
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: executeResponse.result.type === 'analysis' ? 'analysis' : 'transformation',
          data: executeResponse.result,
        },
      };
      addMessage(resultMessage);

      // Update script in previous message
      const scriptMessageIndex = messages.findIndex(
        (m) => m.script?.id === script.id
      );
      if (scriptMessageIndex >= 0) {
        const updatedMessages = [...messages];
        updatedMessages[scriptMessageIndex] = {
          ...updatedMessages[scriptMessageIndex],
          script: updatedScript,
        };
        useChatStore.getState().setMessages(updatedMessages);
      }

      // Save chat history (with error recovery)
      try {
        await saveChatHistory();
      } catch (error) {
        console.error('Failed to save chat history:', error);
        // Don't show error to user for history save failures
        // History will be saved on next successful operation
      }
    } catch (error) {
      console.error('Failed to execute script:', error);
      
      // Improve error message based on error type
      let errorMessageText = 'Script execution failed. ';
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('security') || errorStr.includes('validation')) {
          errorMessageText += 'The script contains potentially unsafe operations and was blocked for security reasons.';
        } else if (errorStr.includes('python') || errorStr.includes('syntax')) {
          errorMessageText += 'Python syntax error. The generated script may need to be reviewed.';
        } else if (errorStr.includes('timeout') || errorStr.includes('cancelled')) {
          errorMessageText += 'Execution was cancelled or timed out.';
        } else if (errorStr.includes('permission') || errorStr.includes('access')) {
          errorMessageText += 'Permission denied. The script may be trying to access restricted resources.';
        } else {
          errorMessageText += error.message;
        }
      } else {
        errorMessageText += String(error);
      }
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMessageText,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: 'error',
        },
      };
      addMessage(errorMessage);
      
      // Update script execution state to failed
      const scriptMessageIndex = messages.findIndex(
        (m) => m.script?.id === script.id
      );
      if (scriptMessageIndex >= 0) {
        const updatedMessages = [...messages];
        const failedScript: Script = {
          ...script,
          executionState: 'failed',
          executionResult: {
            executionId: script.id,
            startedAt: new Date().toISOString(),
            error: errorMessageText,
            result: { type: 'error', message: errorMessageText },
          },
        };
        updatedMessages[scriptMessageIndex] = {
          ...updatedMessages[scriptMessageIndex],
          script: failedScript,
        };
        useChatStore.getState().setMessages(updatedMessages);
      }
    } finally {
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  };

  const pendingScript = useChatStore((state) => state.pendingScript);
  const currentHistory = useChatStore((state) => state.currentHistory);
  
  // Memoize message count for performance
  const messageCount = useMemo(() => messages.length, [messages.length]);

  // Save chat history
  const saveChatHistory = async () => {
    if (!currentFilePath) return;

    const currentMessages = useChatStore.getState().messages;
    const history: ChatHistory = currentHistory || {
      csvPath: currentFilePath,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedHistory: ChatHistory = {
      ...history,
      messages: currentMessages,
      updatedAt: new Date().toISOString(),
    };

    try {
      await invoke('save_chat_history', {
        csvPath: currentFilePath,
        history: updatedHistory,
      });
      setCurrentHistory(updatedHistory);
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  // Save chat history when messages change (with error recovery)
  useEffect(() => {
    if (messages.length > 0 && currentFilePath) {
      // Debounce save to avoid too frequent saves
      const timeoutId = setTimeout(async () => {
        try {
          await saveChatHistory();
        } catch (error) {
          console.error('Failed to save chat history:', error);
          // Silently retry on next change
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentFilePath]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <div className="text-sm font-semibold">AI Assistant</div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ask questions about your data or request transformations
        </p>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-4"
        ref={scrollRef}
      >
        {messageCount === 0 && (
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

        {messages.map((message) => (
          <ChatMessageComponent 
            key={message.id} 
            message={message}
          />
        ))}

        {/* Progress indicator */}
        {executionProgress && (
          <div className="mb-4">
            <ProgressIndicator progress={executionProgress} />
          </div>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 bg-muted/50 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating script...</span>
          </div>
        )}
        
        {/* Executing indicator */}
        {isExecuting && !executionProgress && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 bg-muted/50 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Executing script...</span>
          </div>
        )}
      </div>

      {/* Approval buttons for transformation */}
      {pendingScript && (
        <div className="flex-shrink-0 border-t p-3 bg-muted/50">
          <div className="flex gap-2">
            <Button
              onClick={() => handleExecuteScript(pendingScript, true)}
              disabled={isExecuting}
              className="flex-1"
              size="sm"
            >
              Approve & Execute
            </Button>
            <Button
              onClick={() => useChatStore.getState().setPendingScript(null)}
              disabled={isExecuting}
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
            placeholder={
              data
                ? 'Ask me anything about your data...'
                : 'Please open a CSV file first...'
            }
            disabled={isGenerating || isExecuting || !data}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isGenerating || isExecuting || !input.trim() || !data}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

