// Chat store for managing chat state
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage, ChatHistory } from '../types/chat';
import type { Script, ExecutionProgress } from '../types/script';

interface ChatState {
  // Chat history
  messages: ChatMessage[];
  currentHistory: ChatHistory | null;
  
  // Script execution state
  pendingScript: Script | null;
  executionProgress: ExecutionProgress | null;
  isExecuting: boolean;
  
  // UI state
  isChatOpen: boolean;
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setPendingScript: (script: Script | null) => void;
  setExecutionProgress: (progress: ExecutionProgress | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setCurrentHistory: (history: ChatHistory | null) => void;
  setIsChatOpen: (isOpen: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      // Initial state
      messages: [],
      currentHistory: null,
      pendingScript: null,
      executionProgress: null,
      isExecuting: false,
      isChatOpen: false,
      
      // Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      
      setMessages: (messages) =>
        set({ messages }),
      
      clearMessages: () =>
        set({ messages: [] }),
      
      setPendingScript: (script) =>
        set({ pendingScript: script }),
      
      setExecutionProgress: (progress) =>
        set({ executionProgress: progress }),
      
      setIsExecuting: (isExecuting) =>
        set({ isExecuting }),
      
      setCurrentHistory: (history) =>
        set({ currentHistory: history }),
      
      setIsChatOpen: (isOpen) =>
        set({ isChatOpen: isOpen }),
    }),
    { name: 'ChatStore' }
  )
);

