interface BrandMarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface BrandLogoProps extends BrandMarkProps {
  compact?: boolean;
  tagline?: string;
}

export function BrandMark({ className = '', size = 'md' }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`brand-mark brand-mark--${size} ${className}`.trim()}
    >
      <svg className="brand-mark__svg" viewBox="0 0 64 64" focusable="false">
        <path
          className="brand-mark__neighborhood"
          d="M13 35.5 31.9 17 51 35.5v16.1a2.7 2.7 0 0 1-2.7 2.7H15.7a2.7 2.7 0 0 1-2.7-2.7V35.5Z"
        />
        <path
          className="brand-mark__flow brand-mark__flow--back"
          d="M15 38.5c9.6-11.2 21.9-11.2 31.6-1.1"
        />
        <path
          className="brand-mark__flow"
          d="M17.5 44.2c7.8-8.1 20.6-8 28.9.1"
        />
        <path
          className="brand-mark__flow brand-mark__flow--front"
          d="M23.5 50.2c5.2-4.4 11.8-4.4 17.1-.1"
        />
        <circle className="brand-mark__node brand-mark__node--a" cx="21" cy="33" r="3.4" />
        <circle className="brand-mark__node brand-mark__node--b" cx="43.5" cy="34" r="3.4" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-wordmark">
      <strong>동네결</strong>
      {!compact ? <small>우리 동네에서 이어지는 안전한 중고거래</small> : null}
    </span>
  );
}

export function BrandLogo({
  className = '',
  compact = false,
  size = 'md',
  tagline,
}: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <BrandMark size={size} />
      <span className="brand-wordmark">
        <strong>동네결</strong>
        {!compact ? (
          <small>{tagline ?? '우리 동네에서 이어지는 안전한 중고거래'}</small>
        ) : null}
      </span>
    </span>
  );
}
