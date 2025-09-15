import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCsvStore } from '../store/csvStore';
import type { SaveOptions } from '../hooks/useTauri';

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background border border-border rounded-lg shadow-xl w-96 max-w-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              File Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'tsv')}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-accent focus:border-accent text-foreground"
            >
              <option value="csv">CSV (Comma Separated)</option>
              <option value="tsv">TSV (Tab Separated)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Encoding
            </label>
            <select
              value={encoding}
              onChange={(e) => setEncoding(e.target.value as 'utf8' | 'shift_jis' | 'euc_jp')}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-accent focus:border-accent text-foreground"
            >
              <option value="utf8">UTF-8</option>
              <option value="shift_jis">Shift-JIS</option>
              <option value="euc_jp">EUC-JP</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="backup"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent"
            />
            <label htmlFor="backup" className="text-sm text-foreground">
              Create backup before saving
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}