import React, { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';

interface RowMenuProps {
  rowIndex: number;
  onAddRow: (position: 'above' | 'below') => void;
  onDeleteRow: () => void;
  onDuplicateRow: () => void;
  children: React.ReactNode;
}

export const RowMenu: React.FC<RowMenuProps> = ({
  rowIndex,
  onAddRow,
  onDeleteRow,
  onDuplicateRow,
  children,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    onDeleteRow();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
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
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Row
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete row {rowIndex + 1}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};