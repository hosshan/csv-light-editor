// ChatPanel component - main chat interface for AI assistant
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { Bot, Send, Loader2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ChatMessageComponent } from "./ChatMessage";
import { ProgressIndicator } from "./ProgressIndicator";
import { useChatStore } from "../../store/chatStore";
import { useCsvStore } from "../../store/csvStore";
import type { ChatMessage, ChatHistory } from "../../types/chat";
import type { Script, ExecutionResult } from "../../types/script";

interface ChatPanelProps {
  onClose?: () => void;
}

const normalizeExecutionResult = (raw: any | undefined | null): ExecutionResult | undefined => {
  if (!raw) return undefined;
  return {
    executionId: raw.executionId ?? raw.execution_id ?? "",
    startedAt: raw.startedAt ?? raw.started_at ?? new Date().toISOString(),
    completedAt: raw.completedAt ?? raw.completed_at,
    result: raw.result,
    error: raw.error,
  };
};

const normalizeScript = (raw: any | undefined | null): Script | undefined => {
  if (!raw) return undefined;
  return {
    id: raw.id,
    content: raw.content,
    scriptType: raw.scriptType ?? raw.script_type ?? "analysis",
    generatedAt: raw.generatedAt ?? raw.generated_at ?? new Date().toISOString(),
    userPrompt: raw.userPrompt ?? raw.user_prompt ?? "",
    executionState: raw.executionState ?? raw.execution_state ?? "pending",
    executionResult: normalizeExecutionResult(raw.executionResult ?? raw.execution_result),
  };
};

const normalizeChatMessage = (message: any): ChatMessage => {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    script: normalizeScript(message.script) ?? undefined,
    metadata: message.metadata
      ? {
          messageType: message.metadata.message_type ?? message.metadata.messageType,
          data: message.metadata.data,
        }
      : undefined,
  };
};

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
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
        const response = (await invoke("load_chat_history", {
          csvPath: currentFilePath,
        })) as { history: any | null };

        if (response.history) {
          // Convert snake_case to camelCase for ChatHistory
          const normalizedHistory: ChatHistory = {
            csvPath: response.history.csv_path ?? response.history.csvPath,
            messages: response.history.messages?.map(normalizeChatMessage) ?? [],
            createdAt: response.history.created_at ?? response.history.createdAt,
            updatedAt: response.history.updated_at ?? response.history.updatedAt,
          };
          const normalizedMessages = normalizedHistory.messages;
          setCurrentHistory(normalizedHistory);
          setMessages(normalizedMessages);
        } else {
          setCurrentHistory(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
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
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, executionProgress, scrollToBottom]);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<any>("script-progress", (event) => {
      // Event payload structure: { executionId, progress: { ... } }
      const progressData = event.payload.progress || event.payload;
      setExecutionProgress(progressData);
      setIsExecuting(true);

      // Get current messages from store to avoid stale closure
      const currentMessages = useChatStore.getState().messages;
      const executionId = event.payload.executionId || progressData.executionId;
      const currentStep = progressData.currentStep || progressData.current_step || "Processing...";

      // Update progress message
      const progressMessage: ChatMessage = {
        id: `progress-${executionId}`,
        role: "assistant",
        content: `Processing: ${currentStep}`,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: "progress",
          data: progressData,
        },
      };

      // Update or add progress message
      const existingIndex = currentMessages.findIndex((m) => m.id === `progress-${executionId}`);
      if (existingIndex >= 0) {
        // Update existing progress message
        const updatedMessages = [...currentMessages];
        updatedMessages[existingIndex] = progressMessage;
        useChatStore.getState().setMessages(updatedMessages);
      } else {
        addMessage(progressMessage);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addMessage, setExecutionProgress, setIsExecuting]);

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
        role: "assistant",
        content: "Input is too long. Please keep your prompt under 2000 characters.",
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: "error",
        },
      };
      addMessage(errorMessage);
      return;
    }

    if (isGenerating || isExecuting || !data) {
      return;
    }

    const userPrompt = trimmedInput;
    setInput("");

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    setIsGenerating(true);

    try {
      // Get first 5 rows for column analysis
      const sampleRows = data.rows.slice(0, 5).map((row) => [...row]);

      // Generate script
      const generateResponse = (await invoke("generate_script", {
        prompt: userPrompt,
        csvContext: {
          csv_path: currentFilePath || undefined,
          headers: data.headers,
          row_count: data.rows.length,
          selected_range: null,
          filter_state: null,
          sort_state: null,
          column_info: null,
        },
        sampleRows: sampleRows,
      })) as any;

      // Normalize script from snake_case to camelCase for frontend
      const script: Script = normalizeScript(generateResponse.script) || {
        id: generateResponse.script.id,
        content: generateResponse.script.content,
        scriptType: (generateResponse.script.script_type ?? generateResponse.script_type) as
          | "analysis"
          | "transformation",
        generatedAt: generateResponse.script.generated_at ?? new Date().toISOString(),
        userPrompt: generateResponse.script.user_prompt ?? "",
        executionState: "pending",
      };

      // Add assistant message with script
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          generateResponse.script_type === "transformation"
            ? "I've generated a transformation script. Please review it and approve to execute."
            : "I've generated an analysis script. It will be executed automatically.",
        timestamp: new Date().toISOString(),
        script,
        metadata: {
          messageType:
            generateResponse.script_type === "transformation" ? "transformation" : "analysis",
        },
      };
      addMessage(assistantMessage);

      // Script has been generated, stop loading indicator
      setIsGenerating(false);

      // Auto-execute analysis scripts
      if (generateResponse.script_type === "analysis") {
        await handleExecuteScript(script, false);
      } else {
        // For transformation, set pending script
        useChatStore.getState().setPendingScript(script);
      }
    } catch (error) {
      console.error("Failed to generate script:", error);

      // Improve error message based on error type
      let errorMessageText = "Failed to generate script. ";
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes("api key") || errorStr.includes("authentication")) {
          errorMessageText += "Please check your API key configuration in settings.";
        } else if (errorStr.includes("network") || errorStr.includes("fetch")) {
          errorMessageText += "Network error. Please check your internet connection.";
        } else if (errorStr.includes("timeout")) {
          errorMessageText += "Request timed out. Please try again.";
        } else if (errorStr.includes("rate limit")) {
          errorMessageText += "Rate limit exceeded. Please wait a moment and try again.";
        } else {
          errorMessageText += error.message;
        }
      } else {
        errorMessageText += String(error);
      }

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: errorMessageText,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: "error",
        },
      };
      addMessage(errorMessage);
      setIsGenerating(false);
    }
  };

  const handleExecuteScript = async (script: Script, approval: boolean) => {
    if (!data) return;

    setIsExecuting(true);
    useChatStore.getState().setPendingScript(null);

    try {
      console.log("[ChatPanel] Starting script execution, script id:", script.id);
      let executeResponse: any;
      try {
        executeResponse = (await invoke("execute_script", {
          script: {
            id: script.id,
            content: script.content,
            script_type: script.scriptType ?? "analysis",
            generated_at: script.generatedAt ?? new Date().toISOString(),
            user_prompt: script.userPrompt ?? "",
            execution_state: script.executionState ?? "pending",
            execution_result: script.executionResult
              ? {
                  execution_id: script.executionResult.executionId,
                  started_at: script.executionResult.startedAt,
                  completed_at: script.executionResult.completedAt,
                  result: script.executionResult.result,
                  error: script.executionResult.error,
                }
              : null,
          },
          approval,
          csvData: {
            headers: data.headers,
            rows: data.rows,
          },
        })) as any;
        console.log("[ChatPanel] invoke completed successfully");
      } catch (invokeError) {
        console.error("[ChatPanel] invoke failed with error:", invokeError);
        console.error("[ChatPanel] invoke error type:", typeof invokeError);
        console.error("[ChatPanel] invoke error details:", JSON.stringify(invokeError, null, 2));
        // Re-throw to be caught by outer catch block
        throw invokeError;
      }

      console.log(
        "[ChatPanel] executeResponse received:",
        executeResponse ? "exists" : "null/undefined"
      );
      console.log("[ChatPanel] executeResponse:", JSON.stringify(executeResponse, null, 2));
      console.log("[ChatPanel] result type:", executeResponse?.result?.type);
      console.log("[ChatPanel] result:", executeResponse?.result);
      console.log("[ChatPanel] result type check:", executeResponse?.result?.type === "error");

      // Check if result is an error FIRST, before updating state
      if (!executeResponse) {
        console.error("[ChatPanel] executeResponse is null/undefined");
        setIsExecuting(false);
        throw new Error("No response from script execution");
      }

      if (!executeResponse.result) {
        console.error("[ChatPanel] executeResponse.result is null/undefined");
        setIsExecuting(false);
        throw new Error("No result in script execution response");
      }

      // Check for error result type - use type guard
      const result = executeResponse.result;
      const isError = result && "type" in result && result.type === "error";

      console.log(
        "[ChatPanel] isError check:",
        isError,
        "result type:",
        result?.type,
        "full result:",
        JSON.stringify(result, null, 2)
      );

      if (isError && result && "message" in result) {
        console.log("[ChatPanel] Error detected in result, message:", result.message);
        console.log("[ChatPanel] Error detected, attempting auto-fix");
        const errorMessage =
          (result as { type: "error"; message: string }).message || "Script execution failed.";

        // Try to auto-fix the script (max 2 retries)
        const retryCount = script.executionResult?.retryCount || 0;
        if (retryCount < 2) {
          try {
            console.log(`[ChatPanel] Attempting auto-fix (attempt ${retryCount + 1}/2)`);
            // Get first 5 rows for column analysis
            const sampleRows = data.rows.slice(0, 5).map((row) => [...row]);

            const fixResponse = (await invoke("fix_script", {
              originalPrompt: script.userPrompt || input,
              originalScript: {
                id: script.id,
                content: script.content,
                script_type: script.scriptType ?? "analysis",
                generated_at: script.generatedAt ?? new Date().toISOString(),
                user_prompt: script.userPrompt ?? "",
                execution_state: script.executionState ?? "pending",
                execution_result: script.executionResult
                  ? {
                      execution_id: script.executionResult.executionId,
                      started_at: script.executionResult.startedAt,
                      completed_at: script.executionResult.completedAt,
                      result: script.executionResult.result,
                      error: script.executionResult.error,
                    }
                  : null,
              },
              errorMessage: errorMessage,
              csvContext: {
                csv_path: currentFilePath || undefined,
                headers: data.headers,
                row_count: data.rows.length,
                selected_range: null,
                filter_state: null,
                sort_state: null,
                column_info: null,
              },
              sampleRows: sampleRows,
            })) as any;

            // Normalize script from snake_case to camelCase for frontend
            const normalizedFixedScript = normalizeScript(fixResponse.script);
            const fixedScript: Script = normalizedFixedScript
              ? {
                  ...normalizedFixedScript,
                  id: `${script.id}-fixed-${retryCount + 1}`,
                  executionState: "pending",
                  executionResult: {
                    executionId: "",
                    startedAt: new Date().toISOString(),
                    result: { type: "error", message: "Retrying after fix" },
                    retryCount: retryCount + 1,
                  },
                }
              : {
                  id: `${script.id}-fixed-${retryCount + 1}`,
                  content: fixResponse.script.content,
                  scriptType: (fixResponse.script.script_type ?? "analysis") as
                    | "analysis"
                    | "transformation",
                  generatedAt: fixResponse.script.generated_at ?? new Date().toISOString(),
                  userPrompt: fixResponse.script.user_prompt ?? "",
                  executionState: "pending",
                  executionResult: {
                    executionId: "",
                    startedAt: new Date().toISOString(),
                    result: { type: "error", message: "Retrying after fix" },
                    retryCount: retryCount + 1,
                  },
                };

            // Add message about auto-fix attempt
            const fixMessage: ChatMessage = {
              id: `fix-attempt-${Date.now()}`,
              role: "assistant",
              content: `Script execution failed. Attempting to fix the script automatically (attempt ${retryCount + 1}/2)...`,
              timestamp: new Date().toISOString(),
              metadata: {
                messageType: "error",
              },
            };
            addMessage(fixMessage);

            // Retry execution with fixed script
            await handleExecuteScript(fixedScript, approval);
            return;
          } catch (fixError) {
            console.error("[ChatPanel] Auto-fix failed:", fixError);
            // Fall through to show error message
          }
        }

        // Show error message if auto-fix failed or max retries reached
        console.log("[ChatPanel] Showing error message to user, errorMessage:", errorMessage);
        const errorMessageObj: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            retryCount >= 2
              ? `${errorMessage}\n\nAuto-fix attempts exhausted. Please try regenerating the script with a more specific prompt.`
              : errorMessage,
          timestamp: new Date().toISOString(),
          metadata: {
            messageType: "error",
            data: result,
          },
        };
        console.log("[ChatPanel] Error message object:", JSON.stringify(errorMessageObj, null, 2));
        addMessage(errorMessageObj);
        console.log(
          "[ChatPanel] Error message added to chat, current messages count:",
          messages.length
        );
        // Force scroll to bottom to show error message
        setTimeout(() => scrollToBottom(), 100);

        // Update script execution state to failed
        const scriptMessageIndex = messages.findIndex((m) => m.script?.id === script.id);
        if (scriptMessageIndex >= 0) {
          const updatedMessages = [...messages];
          const failedScript: Script = {
            ...script,
            executionState: "failed",
            executionResult: {
              executionId: executeResponse.execution_id,
              startedAt: new Date().toISOString(),
              error: errorMessage,
              result: result,
              retryCount,
            },
          };
          updatedMessages[scriptMessageIndex] = {
            ...updatedMessages[scriptMessageIndex],
            script: failedScript,
          };
          useChatStore.getState().setMessages(updatedMessages);
        }
        setIsExecuting(false);
        return;
      }

      // Update script execution state for successful execution
      const updatedScript: Script = {
        ...script,
        executionState: "completed",
        executionResult: {
          executionId: executeResponse.execution_id,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: executeResponse.result,
        },
      };

      // Add result message for successful execution
      // Double-check that result is not an error
      const successResult = executeResponse.result;
      if (successResult && "type" in successResult && successResult.type === "error") {
        console.error("[ChatPanel] Unexpected error in success path:", successResult);
        setIsExecuting(false);
        return;
      }

      // Type guard for analysis result
      const isAnalysis =
        successResult && "type" in successResult && successResult.type === "analysis";

      // Handle summary - it might be a string, object, or array
      let content = "Transformation completed successfully!";
      if (isAnalysis && "summary" in successResult) {
        const summaryValue = (successResult as { type: "analysis"; summary: any; details: any })
          .summary;
        if (typeof summaryValue === "string") {
          content = summaryValue;
        } else if (typeof summaryValue === "object" && summaryValue !== null) {
          // Convert object/array to formatted string
          content = JSON.stringify(summaryValue, null, 2);
        } else {
          content = String(summaryValue);
        }
      }

      console.log(
        "[ChatPanel] Creating result message, content:",
        content,
        "isAnalysis:",
        isAnalysis
      );

      const resultMessage: ChatMessage = {
        id: `result-${Date.now()}`,
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: isAnalysis ? "analysis" : "transformation",
          data: successResult,
        },
      };
      console.log("[ChatPanel] Result message created:", JSON.stringify(resultMessage, null, 2));
      console.log("[ChatPanel] Calling addMessage with:", resultMessage.id);
      addMessage(resultMessage);
      console.log("[ChatPanel] Result message added to chat");

      // Force scroll to bottom to show result
      setTimeout(() => {
        scrollToBottom();
        console.log("[ChatPanel] Scrolled to bottom");
      }, 100);

      // Update script in previous message
      // Get latest messages from store to ensure we have the most recent state
      const currentMessages = useChatStore.getState().messages;
      const scriptMessageIndex = currentMessages.findIndex((m) => m.script?.id === script.id);
      if (scriptMessageIndex >= 0) {
        const updatedMessages = [...currentMessages];
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
        console.error("Failed to save chat history:", error);
        // Don't show error to user for history save failures
        // History will be saved on next successful operation
      }

      // Mark execution as complete after successful result processing
      setIsExecuting(false);
      setExecutionProgress(null);
    } catch (error) {
      console.error("[ChatPanel] Failed to execute script:", error);
      console.error("[ChatPanel] Error details:", JSON.stringify(error, null, 2));

      // Improve error message based on error type
      let errorMessageText = "Script execution failed. ";
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        console.log("[ChatPanel] Error message:", error.message);
        if (errorStr.includes("security") || errorStr.includes("validation")) {
          errorMessageText +=
            "The script contains potentially unsafe operations and was blocked for security reasons.";
        } else if (errorStr.includes("python") || errorStr.includes("syntax")) {
          errorMessageText += "Python syntax error. The generated script may need to be reviewed.";
        } else if (errorStr.includes("timeout") || errorStr.includes("cancelled")) {
          errorMessageText += "Execution was cancelled or timed out.";
        } else if (errorStr.includes("permission") || errorStr.includes("access")) {
          errorMessageText +=
            "Permission denied. The script may be trying to access restricted resources.";
        } else {
          errorMessageText += error.message;
        }
      } else if (typeof error === "string") {
        errorMessageText += error;
      } else {
        errorMessageText += String(error);
      }

      console.log("[ChatPanel] Showing error message:", errorMessageText);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: errorMessageText,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: "error",
        },
      };
      addMessage(errorMessage);
      console.log("[ChatPanel] Error message added to chat");
      // Force scroll to bottom to show error message
      setTimeout(() => scrollToBottom(), 100);

      // Update script execution state to failed
      // Get latest messages from store to ensure we have the most recent state
      const currentMessages = useChatStore.getState().messages;
      const scriptMessageIndex = currentMessages.findIndex((m) => m.script?.id === script.id);
      if (scriptMessageIndex >= 0) {
        const updatedMessages = [...currentMessages];
        const failedScript: Script = {
          ...script,
          executionState: "failed",
          executionResult: {
            executionId: script.id,
            startedAt: new Date().toISOString(),
            error: errorMessageText,
            result: { type: "error", message: errorMessageText },
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
      // Convert to Rust format (snake_case for ChatHistory/ChatMessage, camelCase for Script)
      const rustHistory = {
        csv_path: updatedHistory.csvPath,
        messages: updatedHistory.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          script: msg.script
            ? {
                // Convert Script from camelCase (frontend) to snake_case (Rust)
                id: msg.script.id,
                content: msg.script.content,
                script_type: msg.script.scriptType,
                generated_at: msg.script.generatedAt,
                user_prompt: msg.script.userPrompt,
                execution_state: msg.script.executionState,
                execution_result: msg.script.executionResult
                  ? {
                      execution_id: msg.script.executionResult.executionId,
                      started_at: msg.script.executionResult.startedAt,
                      completed_at: msg.script.executionResult.completedAt,
                      result: msg.script.executionResult.result,
                      error: msg.script.executionResult.error,
                    }
                  : null,
              }
            : null,
          metadata: {
            message_type: msg.metadata?.messageType,
            data: msg.metadata?.data,
          },
        })),
        created_at: updatedHistory.createdAt,
        updated_at: updatedHistory.updatedAt,
      };

      await invoke("save_chat_history", {
        csvPath: currentFilePath,
        history: rustHistory,
      });
      setCurrentHistory(updatedHistory);
    } catch (error) {
      console.error("Failed to save chat history:", error);
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
          console.error("Failed to save chat history:", error);
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
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ask questions about your data or request transformations
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0" ref={scrollRef}>
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
          <ChatMessageComponent key={message.id} message={message} />
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
              data ? "Ask me anything about your data..." : "Please open a CSV file first..."
            }
            disabled={isGenerating || isExecuting || !data}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isGenerating || isExecuting || !input.trim() || !data}
            className="h-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
