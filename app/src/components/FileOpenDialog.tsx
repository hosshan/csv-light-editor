import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/Button';

interface FileOpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInCurrentWindow: () => void;
  onOpenInNewWindow: () => void;
  fileName: string;
}

export function FileOpenDialog({
  isOpen,
  onClose,
  onOpenInCurrentWindow,
  onOpenInNewWindow,
  fileName
}: FileOpenDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open File</DialogTitle>
          <DialogDescription>
            You currently have a file open. How would you like to open <strong>{fileName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onOpenInNewWindow}
            className="w-full sm:w-auto"
          >
            Open in New Window
          </Button>
          <Button
            onClick={onOpenInCurrentWindow}
            className="w-full sm:w-auto"
          >
            Open in This Window
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
