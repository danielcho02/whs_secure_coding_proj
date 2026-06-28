import { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface DrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Drawer({ children, onClose, open, title }: DrawerProps) {
  useEffect(() => {
    document.body.classList.toggle('is-sheet-open', open);

    if (!open) {
      return () => document.body.classList.remove('is-sheet-open');
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('is-sheet-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="overlay overlay--drawer" role="presentation">
      <button className="overlay__scrim" onClick={onClose} type="button" />
      <aside aria-modal="true" className="drawer-panel" role="dialog">
        <header className="drawer-panel__header">
          <h2>{title}</h2>
          <IconButton label="닫기" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </aside>
    </div>
  );
}
