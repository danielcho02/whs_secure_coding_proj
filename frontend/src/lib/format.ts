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

export function transactionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    REQUESTED: '요청됨',
    RESERVED: '예약됨',
    PAYMENT_PENDING: '결제 대기',
    PAID: '결제 완료',
    SHIPPING: '전달 준비',
    COMPLETED: '거래 완료',
    CANCELLED: '취소됨',
    REFUNDED: '환불됨',
  };

  return labels[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '결제 대기',
    PAID: '결제 완료',
    FAILED: '결제 실패',
    CANCELED: '결제 취소',
    REFUND_REQUESTED: '환불 요청',
    REFUNDED: '환불 완료',
  };

  return labels[status] ?? status;
}

export function reportStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '접수',
    REVIEWING: '검토 중',
    RESOLVED: '처리 완료',
    REJECTED: '반려',
  };

  return labels[status] ?? status;
}

export function reportTargetLabel(targetType: string): string {
  const labels: Record<string, string> = {
    PRODUCT: '상품',
    USER: '사용자',
    CHAT: '채팅 메시지',
  };

  return labels[targetType] ?? targetType;
}

export function userStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: '정상',
    SUSPENDED: '정지',
    BANNED: '차단',
    WITHDRAWN: '탈퇴',
  };

  return labels[status] ?? status;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function notificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CHAT: '채팅',
    TRANSACTION: '거래',
    TX: '거래',
    REPORT: '신고',
    ADMIN_REPORT: '관리',
  };

  return labels[type] ?? '알림';
}

export function adminActionLabel(action: string): string {
  const labels: Record<string, string> = {
    HIDE_PRODUCT: '상품 숨김',
    RESTORE_PRODUCT: '상품 복구',
    SUSPEND_USER: '사용자 정지',
    RESTORE_USER: '사용자 복구',
    UPDATE_REPORT_STATUS: '신고 상태 변경',
  };

  return labels[action] ?? '관리자 조치';
}

export function notificationTitle(type: string, fallback: string): string {
  const titles: Record<string, string> = {
    CHAT: '새 메시지가 도착했습니다',
    TRANSACTION: '거래 진행 상황을 확인해주세요',
    TX: '거래 진행 상황을 확인해주세요',
    REPORT: '신고가 처리되었습니다',
    ADMIN_REPORT: '검토할 신고가 있습니다',
    FAVORITE: '관심 상품 소식',
  };

  return titles[type] ?? fallback;
}

export function trustSummary(completedTx: number, trustScore: number): string {
  if (completedTx >= 2) {
    return `안전거래 ${completedTx}건`;
  }

  return `신뢰도 ${trustScore}점`;
}

export function trustDetail(completedTx: number, trustScore: number): string {
  return `신뢰도 ${trustScore}점 · 완료 거래 ${completedTx}건`;
}
