import { useState, useEffect } from 'react';
import { useCsvStore } from '../store/csvStore';
import type { SaveOptions } from '../hooks/useTauri';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/Button';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (options: SaveOptions) => void;
  title?: string;
}

export function SaveDialog({ isOpen, onClose, onSave, title = 'Save As' }: SaveDialogProps) {
  const { data } = useCsvStore();

  // Initialize encoding based on current file's encoding
  const getInitialEncoding = (): 'utf8' | 'shift_jis' | 'euc_jp' => {
    if (!data?.metadata?.encoding) return 'utf8';
    const enc = data.metadata.encoding.toLowerCase();
    if (enc.includes('shift') || enc.includes('sjis')) return 'shift_jis';
    if (enc.includes('euc')) return 'euc_jp';
    return 'utf8';
  };

  const [format, setFormat] = useState<'csv' | 'tsv'>('csv');
  const [encoding, setEncoding] = useState<'utf8' | 'shift_jis' | 'euc_jp'>(getInitialEncoding());
  const [createBackup, setCreateBackup] = useState(false);

  // Reset encoding when dialog opens with a new file
  useEffect(() => {
    if (isOpen) {
      setEncoding(getInitialEncoding());
    }
  }, [isOpen, data?.metadata?.encoding]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      format,
      encoding,
      createBackup
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="format">File Format</Label>
            <Select value={format} onValueChange={(value: string) => setFormat(value as 'csv' | 'tsv')}>
              <SelectTrigger id="format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Comma Separated)</SelectItem>
                <SelectItem value="tsv">TSV (Tab Separated)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="encoding">Encoding</Label>
            <Select value={encoding} onValueChange={(value: string) => setEncoding(value as 'utf8' | 'shift_jis' | 'euc_jp')}>
              <SelectTrigger id="encoding">
                <SelectValue placeholder="Select encoding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf8">UTF-8</SelectItem>
                <SelectItem value="shift_jis">Shift-JIS</SelectItem>
                <SelectItem value="euc_jp">EUC-JP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="backup"
              checked={createBackup}
              onCheckedChange={(checked: boolean | 'indeterminate') => setCreateBackup(checked === true)}
            />
            <Label htmlFor="backup">Create backup before saving</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}