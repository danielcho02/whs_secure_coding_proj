import { Camera, ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isPlaceholderImageUrl, toDisplayImageUrl } from './imageUrl';

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
  const displaySrc = toDisplayImageUrl(src);
  const shouldLoadImage = Boolean(displaySrc) && !isPlaceholderImageUrl(displaySrc);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>(
    shouldLoadImage ? 'loading' : 'failed',
  );

  useEffect(() => {
    setStatus(shouldLoadImage ? 'loading' : 'failed');
  }, [displaySrc, shouldLoadImage]);

  return (
    <span className={`image-fallback-frame ${className}`.trim()}>
      {shouldLoadImage && displaySrc && status !== 'failed' ? (
        <img
          alt={status === 'loaded' ? alt : ''}
          aria-hidden={status !== 'loaded'}
          className="image-fallback-frame__image"
          decoding="async"
          loading="lazy"
          onError={() => setStatus('failed')}
          onLoad={() => setStatus('loaded')}
          src={displaySrc}
        />
      ) : null}
      {status !== 'loaded' ? (
        <FallbackSurface
          alt={alt}
          category={category}
          loading={shouldLoadImage && status === 'loading'}
          title={title}
        />
      ) : null}
    </span>
  );
}

function FallbackSurface({
  alt,
  category,
  loading,
  title,
}: {
  alt: string;
  category?: string;
  loading: boolean;
  title: string;
}) {
  return (
    <span
      className={`image-fallback ${loading ? 'image-fallback--loading' : ''}`}
      role="img"
      aria-label={alt}
    >
      <span className="image-fallback__pattern" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="image-fallback__icon" aria-hidden="true">
        {loading ? <Camera size={18} /> : <ImageOff size={18} />}
      </span>
      <span className="image-fallback__mark">{title.trim().slice(0, 1) || '동'}</span>
      <span className="image-fallback__label">
        {loading ? '사진 불러오는 중' : '사진 준비중'}
      </span>
      {category ? <span className="image-fallback__category">{category}</span> : null}
    </span>
  );
}
