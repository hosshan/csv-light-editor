import { useState, useRef, useCallback } from 'react';

export interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  draggedType: 'row' | 'column' | null;
  dropTargetIndex: number | null;
  dragOffset: { x: number; y: number };
}

export interface DragHandlers {
  onDragStart: (index: number, type: 'row' | 'column', event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  onDragOver: (index: number, event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
}

interface UseDragAndDropProps {
  onMove: (fromIndex: number, toIndex: number, type: 'row' | 'column') => void;
}

export function useDragAndDrop({ onMove }: UseDragAndDropProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    draggedType: null,
    dropTargetIndex: null,
    dragOffset: { x: 0, y: 0 },
  });

  const dragStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const onDragStart = useCallback((index: number, type: 'row' | 'column', event: React.DragEvent) => {
    // Store the drag start position
    dragStartPosition.current = { x: event.clientX, y: event.clientY };

    // Set drag image to be transparent or a custom element
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0.7';
    dragImage.style.background = 'rgba(59, 130, 246, 0.5)';
    dragImage.style.border = '2px solid #3b82f6';
    dragImage.style.borderRadius = '4px';
    dragImage.style.padding = '4px 8px';
    dragImage.style.fontSize = '12px';
    dragImage.style.color = '#1e40af';
    dragImage.textContent = type === 'row' ? `Row ${index + 1}` : `Column ${index + 1}`;

    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 50, 20);

    // Clean up the drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    // Set drag data
    const dragData = `${type}:${index}`;
    event.dataTransfer.setData('text/plain', dragData);
    event.dataTransfer.effectAllowed = 'move';

    setDragState(prev => ({
      ...prev,
      isDragging: true,
      draggedIndex: index,
      draggedType: type,
      dragOffset: { x: 0, y: 0 },
    }));
  }, []);

  const onDragEnd = useCallback((event: React.DragEvent) => {
    const currentState = dragState;

    // If dropEffect is 'move' and we have a drop target, perform the move
    if (event.dataTransfer.dropEffect === 'move' &&
        currentState.dropTargetIndex !== null &&
        currentState.draggedIndex !== null &&
        currentState.draggedType !== null &&
        currentState.draggedIndex !== currentState.dropTargetIndex) {
      onMove(currentState.draggedIndex, currentState.dropTargetIndex, currentState.draggedType);
    }

    setDragState({
      isDragging: false,
      draggedIndex: null,
      draggedType: null,
      dropTargetIndex: null,
      dragOffset: { x: 0, y: 0 },
    });
  }, [dragState, onMove]);

  const onDragOver = useCallback((index: number, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    setDragState(prev => ({
      ...prev,
      dropTargetIndex: index,
      dragOffset: {
        x: event.clientX - dragStartPosition.current.x,
        y: event.clientY - dragStartPosition.current.y,
      },
    }));
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Only clear drop target if we're actually leaving the drop zone
    const relatedTarget = event.relatedTarget as Element;
    const currentTarget = event.currentTarget as Element;

    if (!currentTarget.contains(relatedTarget)) {
      setDragState(prev => ({
        ...prev,
        dropTargetIndex: null,
      }));
    }
  }, []);


  const handlers: DragHandlers = {
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
  };

  return {
    dragState,
    handlers,
  };
}