import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({
  active = false,
  children,
  className = '',
  label,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${active ? 'is-active' : ''} ${className}`.trim()}
      title={label}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
