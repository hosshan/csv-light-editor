import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/Button';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  fileName?: string;
}

export function NewFileDialog({
  isOpen,
  onClose,
  onDiscard,
  onSave,
  fileName
}: NewFileDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>未保存の変更があります</DialogTitle>
          <DialogDescription>
            {fileName ? (
              <>
                <strong>{fileName}</strong> に未保存の変更があります。
                新規ファイルを作成する前に、変更を保存しますか？
              </>
            ) : (
              <>
                未保存の変更があります。
                新規ファイルを作成する前に、変更を保存しますか？
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscard}
            className="w-full sm:w-auto"
          >
            保存せずに新規作成
          </Button>
          <Button
            onClick={onSave}
            className="w-full sm:w-auto"
          >
            保存してから新規作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

