import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './AppDialog.css';

type AppDialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  busy?: boolean;
  wide?: boolean;
  focusKey?: string | number;
  onClose: () => void;
  children: React.ReactNode;
};

export const AppDialog: React.FC<AppDialogProps> = ({ title, eyebrow, description, busy = false, wide = false, focusKey, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>('.app-dialog-body input:not([disabled]), .app-dialog-body select:not([disabled]), .app-dialog-body textarea:not([disabled]), .app-dialog-body button:not([disabled])')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (previous?.isConnected && !previous.matches(':disabled')) previous.focus();
      });
    };
  }, []);
  useEffect(() => {
    if (focusKey === undefined) return;
    ref.current?.querySelector<HTMLElement>('.app-dialog-body input:not([disabled]), .app-dialog-body select:not([disabled]), .app-dialog-body textarea:not([disabled]), .app-dialog-body button:not([disabled])')?.focus();
  }, [focusKey]);
  return <dialog
    ref={ref}
    className={`app-dialog${wide ? ' app-dialog-wide' : ''}`}
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (busy || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
  >
    <div className="app-dialog-head">
      <div>{eyebrow && <p className="app-dialog-eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{description && <p className="app-dialog-description" id={descriptionId}>{description}</p>}</div>
      <button type="button" className="app-dialog-close" disabled={busy} onClick={onClose} aria-label="Fechar janela"><X size={19} /></button>
    </div>
    <div className="app-dialog-body">{children}</div>
  </dialog>;
};
