import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';

interface RowMenuProps {
  rowIndex: number;
  onAddRow: (position: 'above' | 'below') => void;
  onDeleteRow: () => void;
  onDuplicateRow: () => void;
  children: React.ReactNode;
}

export const RowMenu: React.FC<RowMenuProps> = ({
  rowIndex: _rowIndex,
  onAddRow,
  onDeleteRow,
  onDuplicateRow,
  children,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAddRow('above')}>
          <ArrowUp className="mr-2 h-4 w-4" />
          Insert Row Above
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAddRow('below')}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Insert Row Below
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDuplicateRow}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate Row
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDeleteRow}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Row
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};