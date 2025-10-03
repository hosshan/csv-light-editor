import React, { useState, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';

interface ColumnResizeHandleProps {
  columnIndex: number;
  onResize: (columnIndex: number, width: number) => void;
  currentWidth: number;
}

export const ColumnResizeHandle: React.FC<ColumnResizeHandleProps> = ({
  columnIndex,
  onResize,
  currentWidth,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startXValue = e.clientX;
    const startWidthValue = currentWidth;

    setIsResizing(true);

    // Add a global class to prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXValue;
      const newWidth = Math.max(50, Math.min(500, startWidthValue + deltaX)); // Min 50px, Max 500px
      onResize(columnIndex, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnIndex, onResize, currentWidth]);

  return (
    <div
      ref={handleRef}
      className={cn(
        "absolute right-0 top-0 h-full cursor-col-resize bg-transparent hover:bg-blue-400/30 transition-colors",
        "flex items-center justify-center",
        isResizing && "bg-blue-400/30"
      )}
      onMouseDown={handleMouseDown}
      style={{
        right: '-3px',
        width: '6px',
        zIndex: 10,
      }}
    >
      <div
        className={cn(
          "w-0.5 h-6 bg-border transition-colors opacity-0 hover:opacity-100",
          "hover:bg-blue-500",
          isResizing && "bg-blue-500 opacity-100"
        )}
      />
    </div>
  );
};