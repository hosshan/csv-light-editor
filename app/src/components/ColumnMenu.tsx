import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ColumnMenuProps {
  columnIndex: number;
  columnName: string;
  onAddColumn: (position: 'before' | 'after') => void;
  onDeleteColumn: () => void;
  onRenameColumn: (newName: string) => void;
}

export const ColumnMenu: React.FC<ColumnMenuProps> = ({
  columnIndex,
  columnName,
  onAddColumn,
  onDeleteColumn,
  onRenameColumn,
}) => {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState(columnName);
  const [addPosition, setAddPosition] = useState<'before' | 'after'>('after');
  const [newColumnNameForAdd, setNewColumnNameForAdd] = useState('');

  const handleRename = () => {
    if (newColumnName.trim()) {
      onRenameColumn(newColumnName.trim());
      setIsRenameDialogOpen(false);
    }
  };

  const handleAddColumn = () => {
    if (newColumnNameForAdd.trim()) {
      onAddColumn(addPosition);
      setIsAddDialogOpen(false);
      setNewColumnNameForAdd('');
    }
  };

  const handleDelete = () => {
    onDeleteColumn();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename Column
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setAddPosition('before');
              setIsAddDialogOpen(true);
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Add Column Before
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setAddPosition('after');
              setIsAddDialogOpen(true);
            }}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Add Column After
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
            <DialogDescription>
              Enter a new name for the column "{columnName}"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Column Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
            <DialogDescription>
              Add a new column {addPosition === 'before' ? 'before' : 'after'} "{columnName}"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-column-name" className="text-right">
                Name
              </Label>
              <Input
                id="new-column-name"
                value={newColumnNameForAdd}
                onChange={(e) => setNewColumnNameForAdd(e.target.value)}
                placeholder="New Column"
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddColumn();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn}>Add Column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Column</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the column "{columnName}"? This action cannot be undone.
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