import React from 'react';
import { GripVertical, GripHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DragHandleProps {
  type: 'row' | 'column';
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (index: number, type: 'row' | 'column', event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  className?: string;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  type,
  index,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  className,
}) => {
  const handleDragStart = (event: React.DragEvent) => {
    onDragStart(index, type, event);
  };

  const handleDragEnd = (event: React.DragEvent) => {
    onDragEnd(event);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'flex items-center justify-center cursor-move transition-colors',
        'hover:bg-blue-100 hover:text-blue-600',
        'active:bg-blue-200',
        {
          'opacity-50': isDragging,
          'bg-blue-100 text-blue-600': isDropTarget,
          'bg-blue-200': isDragging && isDropTarget,
        },
        className
      )}
      title={`Drag to reorder ${type}`}
    >
      {type === 'row' ? (
        <GripVertical className="h-3 w-3" />
      ) : (
        <GripHorizontal className="h-3 w-3" />
      )}
    </div>
  );
};