import { useEffect, useState } from 'react';

interface ImageFallbackProps {
  src?: string | null;
  alt: string;
  title: string;
  category?: string;
  className?: string;
}

export function ImageFallback({
  alt,
  category,
  className = '',
  src,
  title,
}: ImageFallbackProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`image-fallback ${className}`.trim()} role="img" aria-label={alt}>
        <span className="image-fallback__mark">{title.trim().slice(0, 1) || '동'}</span>
        {category ? <span className="image-fallback__category">{category}</span> : null}
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}
