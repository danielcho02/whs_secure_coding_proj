import { RefreshCw } from 'lucide-react';
import { BrandMark } from './BrandLogo';
import { Button } from './Button';

interface StateViewProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  actionLabel,
  description,
  onAction,
  title,
}: StateViewProps) {
  return (
    <section className="state-view state-view--empty">
      <div className="state-view__symbol" aria-hidden="true">
        <BrandMark size="lg" />
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}

export function ErrorState({
  actionLabel = '다시 시도',
  description,
  onAction,
  title,
}: StateViewProps) {
  return (
    <section className="state-view state-view--error">
      <div className="state-view__symbol" aria-hidden="true">
        <BrandMark size="lg" />
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {onAction ? (
        <Button icon={<RefreshCw size={17} />} onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
