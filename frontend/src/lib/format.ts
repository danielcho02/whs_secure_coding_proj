export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ko-KR').format(price);
}

export function formatCompactDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) {
    return '방금 전';
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}분 전`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}시간 전`;
  }

  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)}일 전`;
  }

  return formatCompactDate(value);
}

export function productStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ON_SALE: '판매중',
    RESERVED: '예약중',
    SOLD: '거래완료',
    HIDDEN: '숨김',
  };

  return labels[status] ?? status;
}

export function notificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CHAT: '채팅',
    TRANSACTION: '거래',
    REPORT: '신고',
    ADMIN_REPORT: '관리',
  };

  return labels[type] ?? '알림';
}
