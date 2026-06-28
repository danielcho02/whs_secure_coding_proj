export function ProductFeedSkeleton() {
  return (
    <div className="feed-list" aria-label="상품 목록을 불러오는 중">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="product-tile product-tile--skeleton" key={index}>
          <div className="skeleton skeleton--image" />
          <div className="product-tile__content">
            <div className="skeleton skeleton--line skeleton--wide" />
            <div className="skeleton skeleton--line skeleton--short" />
            <div className="skeleton skeleton--line skeleton--medium" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="detail-page">
      <div className="skeleton detail-hero-skeleton" />
      <div className="detail-body">
        <div className="skeleton skeleton--line skeleton--wide" />
        <div className="skeleton skeleton--line skeleton--short" />
        <div className="skeleton skeleton--paragraph" />
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="notification-list" aria-label="알림을 불러오는 중">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="notification-row" key={index}>
          <div className="skeleton skeleton--dot" />
          <div className="notification-row__body">
            <div className="skeleton skeleton--line skeleton--medium" />
            <div className="skeleton skeleton--line skeleton--wide" />
          </div>
        </div>
      ))}
    </div>
  );
}
