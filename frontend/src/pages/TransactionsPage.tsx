import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import {
  CheckCircle2,
  CreditCard,
  FileText,
  PackageCheck,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toFriendlyError } from '../api/errors';
import {
  approvePayment,
  confirmPayment,
  createPayment,
  getReceipt,
  requestRefund,
  type Payment,
} from '../api/payments';
import {
  cancelTransaction,
  completeTransaction,
  createReview,
  listTransactions,
  reserveTransaction,
  type Transaction,
  type TransactionRole,
  type TransactionStatus,
} from '../api/transactions';
import { useAuth } from '../auth/useAuth';
import {
  formatDateTime,
  formatPrice,
  paymentStatusLabel,
  transactionStatusLabel,
} from '../lib/format';
import { Button } from '../ui/Button';
import { ImageFallback } from '../ui/ImageFallback';
import { ConfirmModal } from '../ui/SafetyActions';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

const TX_STATUSES: TransactionStatus[] = [
  'REQUESTED',
  'RESERVED',
  'PAYMENT_PENDING',
  'PAID',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
];

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = parseRole(searchParams.get('role'));
  const status = parseStatus(searchParams.get('status'));
  const txQuery = useQuery({
    queryKey: ['transactions', { role, status }],
    queryFn: () => listTransactions({ role, status, limit: 50 }),
  });
  const transactions = txQuery.data?.items ?? [];

  return (
    <section className="transactions-page" aria-labelledby="transactions-title">
      <header className="page-head page-head--stack">
        <div>
          <p className="section-kicker">거래</p>
          <h1 id="transactions-title">안전결제 흐름</h1>
        </div>
        <div className="segmented-control">
          {[
            { value: 'all', label: '전체' },
            { value: 'buyer', label: '구매' },
            { value: 'seller', label: '판매' },
          ].map((item) => (
            <button
              className={role === item.value ? 'is-selected' : ''}
              key={item.value}
              onClick={() => setSearchParams(nextParams({ role: item.value, status }))}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="chip-row">
        <button
          className={`filter-chip ${!status ? 'is-selected' : ''}`}
          onClick={() => setSearchParams(nextParams({ role, status: undefined }))}
          type="button"
        >
          모든 상태
        </button>
        {TX_STATUSES.map((item) => (
          <button
            className={`filter-chip ${status === item ? 'is-selected' : ''}`}
            key={item}
            onClick={() => setSearchParams(nextParams({ role, status: item }))}
            type="button"
          >
            {transactionStatusLabel(item)}
          </button>
        ))}
      </div>

      {txQuery.isError ? (
        <ErrorState
          description={toFriendlyError(txQuery.error).message}
          onAction={() => void txQuery.refetch()}
          title="거래 내역을 불러오지 못했습니다"
        />
      ) : null}
      {!txQuery.isLoading && !txQuery.isError && transactions.length === 0 ? (
        <EmptyState
          description="상품 상세에서 거래 요청을 보내면 안전결제 흐름이 시작됩니다."
          title="표시할 거래가 없습니다"
        />
      ) : null}
      {transactions.length > 0 ? (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      ) : txQuery.isLoading ? (
        <div className="transaction-list is-loading" />
      ) : null}
    </section>
  );
}

export function TransactionDetailPage() {
  const { transactionId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<'reserve' | 'cancel' | 'complete' | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const txQuery = useQuery({
    queryKey: ['transactions', { role: 'all' }],
    queryFn: () => listTransactions({ role: 'all', limit: 100 }),
  });

  const transaction = useMemo(
    () => txQuery.data?.items.find((item) => item.id === transactionId),
    [transactionId, txQuery.data?.items],
  );

  const role = transaction?.buyer.id === user?.id ? 'buyer' : 'seller';

  const actionMutation = useMutation({
    mutationFn: async (action: 'reserve' | 'cancel' | 'complete') => {
      if (!transactionId) {
        throw new Error('TRANSACTION_ID_REQUIRED');
      }
      if (action === 'reserve') return reserveTransaction(transactionId);
      if (action === 'cancel') return cancelTransaction(transactionId);
      return completeTransaction(transactionId);
    },
    onSuccess: async () => {
      setConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showToast('거래 상태가 변경되었습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId) {
        throw new Error('TRANSACTION_ID_REQUIRED');
      }
      return createPayment({
        transactionId,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async (createdPayment) => {
      setPayment(createdPayment);
      try {
        await requestTossCheckout(createdPayment);
      } catch (error) {
        showToast(toFriendlyError(error).message, 'error');
      }
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: () => confirmPayment(payment?.id ?? ''),
    onSuccess: (updatedPayment) => {
      setPayment(updatedPayment);
      showToast('구매확정이 완료되었습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => requestRefund(payment?.id ?? '', { reason: '구매자 환불 요청' }),
    onSuccess: (updatedPayment) => {
      setPayment(updatedPayment);
      showToast('환불 요청을 전송했습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      createReview(transactionId ?? '', {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      }),
    onSuccess: () => {
      setReviewComment('');
      showToast('거래 후기를 남겼습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  if (txQuery.isLoading) {
    return <div className="transaction-detail is-loading" />;
  }

  if (txQuery.isError) {
    return (
      <ErrorState
        description={toFriendlyError(txQuery.error).message}
        onAction={() => void txQuery.refetch()}
        title="거래 상세를 불러오지 못했습니다"
      />
    );
  }

  if (!transaction) {
    return (
      <EmptyState
        description="현재 백엔드에는 거래 단건 조회 API가 없어 목록에 없는 거래는 상세를 표시할 수 없습니다."
        title="거래 상세 API가 필요합니다"
      />
    );
  }

  return (
    <section className="transaction-detail" aria-labelledby="transaction-title">
      <header className="transaction-hero">
        <ImageFallback
          alt={`${transaction.product.title} 상품 사진`}
          src={transaction.product.thumbnailUrl}
          title={transaction.product.title}
        />
        <div>
          <p className="section-kicker">{role === 'buyer' ? '구매 거래' : '판매 거래'}</p>
          <h1 id="transaction-title">{transaction.product.title}</h1>
          <strong>{formatPrice(transaction.amount)}원</strong>
        </div>
      </header>

      <section className="status-timeline" aria-label="거래 상태">
        {TX_STATUSES.slice(0, 6).map((item) => (
          <span
            className={isStatusReached(transaction.status, item) ? 'is-reached' : ''}
            key={item}
          >
            <i />
            {transactionStatusLabel(item)}
          </span>
        ))}
      </section>

      <section className="transaction-panel">
        <h2>가능한 작업</h2>
        <div className="action-grid">
          {role === 'seller' && transaction.status === 'REQUESTED' ? (
            <Button
              icon={<PackageCheck size={17} />}
              onClick={() => setConfirmAction('reserve')}
            >
              예약 승인
            </Button>
          ) : null}
          {role === 'buyer' &&
          (transaction.status === 'RESERVED' || transaction.status === 'PAYMENT_PENDING') ? (
            <Button
              icon={<CreditCard size={17} />}
              loading={paymentMutation.isPending}
              onClick={() => paymentMutation.mutate()}
            >
              안전결제 진행
            </Button>
          ) : null}
          {transaction.status !== 'COMPLETED' && transaction.status !== 'CANCELLED' ? (
            <Button
              icon={<XCircle size={17} />}
              onClick={() => setConfirmAction('cancel')}
              variant="secondary"
            >
              거래 취소
            </Button>
          ) : null}
          {role === 'buyer' && (transaction.status === 'PAID' || transaction.status === 'SHIPPING') ? (
            <Button
              icon={<CheckCircle2 size={17} />}
              onClick={() => setConfirmAction('complete')}
            >
              거래 완료
            </Button>
          ) : null}
          {payment ? (
            <>
              <Button
                icon={<CheckCircle2 size={17} />}
                loading={confirmPaymentMutation.isPending}
                onClick={() => confirmPaymentMutation.mutate()}
                variant="secondary"
              >
                구매확정
              </Button>
              <Button
                icon={<RefreshCw size={17} />}
                loading={refundMutation.isPending}
                onClick={() => refundMutation.mutate()}
                variant="quiet"
              >
                환불 요청
              </Button>
            </>
          ) : null}
        </div>
      </section>

      {payment ? <PaymentSummary payment={payment} /> : null}

      <form
        className="review-box"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          reviewMutation.mutate();
        }}
      >
        <h2>거래 후기</h2>
        <label className="field">
          <span>평점</span>
          <input
            max={5}
            min={1}
            onChange={(event) => setReviewRating(Number(event.target.value))}
            type="number"
            value={reviewRating}
          />
        </label>
        <label className="field">
          <span>코멘트</span>
          <textarea
            maxLength={500}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder="거래 경험을 남겨주세요."
            value={reviewComment}
          />
        </label>
        <Button icon={<Star size={17} />} loading={reviewMutation.isPending} type="submit">
          후기 남기기
        </Button>
      </form>

      <ConfirmModal
        confirmLabel={confirmAction === 'cancel' ? '취소' : '확인'}
        danger={confirmAction === 'cancel'}
        description="상태 변경은 서버 권한과 현재 상태를 확인한 뒤 처리됩니다."
        loading={actionMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actionMutation.mutate(confirmAction)}
        open={Boolean(confirmAction)}
        title="거래 상태를 변경할까요?"
      />
    </section>
  );
}

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const paymentId = searchParams.get('paymentId');
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = Number(searchParams.get('amount'));
  const approveMutation = useMutation({
    mutationFn: () => {
      if (!paymentId || !paymentKey || !orderId || !Number.isSafeInteger(amount)) {
        throw new Error('PAYMENT_CALLBACK_MISSING');
      }

      return approvePayment(paymentId, { paymentKey, orderId, amount });
    },
    onError: (error) => {
      showToast(
        error instanceof Error && error.message === 'PAYMENT_CALLBACK_MISSING'
          ? '결제 승인에 필요한 callback 정보가 부족합니다.'
          : toFriendlyError(error).message,
        'error',
      );
    },
  });

  useEffect(() => {
    if (!approveMutation.isIdle) {
      return;
    }
    approveMutation.mutate();
  }, [approveMutation, amount, orderId, paymentId, paymentKey]);

  return (
    <section className="payment-result">
      <CreditCard size={32} />
      <h1>결제 승인 확인 중</h1>
      <p>브라우저 성공 화면만으로 거래를 완료하지 않고, 서버 승인 결과를 기다립니다.</p>
      {approveMutation.data ? <PaymentSummary payment={approveMutation.data} /> : null}
      {approveMutation.isError ? (
        <ErrorState title="결제 승인 실패" description="결제 정보를 다시 확인해주세요." />
      ) : null}
    </section>
  );
}

export function PaymentFailPage({ type = 'fail' }: { type?: 'fail' | 'cancel' }) {
  const [searchParams] = useSearchParams();
  return (
    <section className="payment-result payment-result--fail">
      <XCircle size={32} />
      <h1>{type === 'cancel' ? '결제를 취소했습니다' : '결제를 완료하지 못했습니다'}</h1>
      <p>{searchParams.get('message') ?? '서버 상태는 변경하지 않았습니다.'}</p>
      <Link className="button button--secondary" to="/transactions">
        거래 내역으로
      </Link>
    </section>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <Link className="transaction-row" to={`/transactions/${transaction.id}`}>
      <ImageFallback
        alt={`${transaction.product.title} 상품 사진`}
        src={transaction.product.thumbnailUrl}
        title={transaction.product.title}
      />
      <div>
        <span className="transaction-row__meta">
          {transactionStatusLabel(transaction.status)} · {formatDateTime(transaction.updatedAt)}
        </span>
        <h2>{transaction.product.title}</h2>
        <strong>{formatPrice(transaction.amount)}원</strong>
        <small>
          구매 {transaction.buyer.nickname} · 판매 {transaction.seller.nickname}
        </small>
      </div>
    </Link>
  );
}

function PaymentSummary({ payment }: { payment: Payment }) {
  const receiptQuery = useQuery({
    enabled: payment.status === 'PAID',
    queryKey: ['paymentReceipt', payment.id],
    queryFn: () => getReceipt(payment.id),
  });

  return (
    <section className="payment-summary">
      <h2>안전결제 상태</h2>
      <dl>
        <div>
          <dt>상태</dt>
          <dd>{paymentStatusLabel(payment.status)}</dd>
        </div>
        <div>
          <dt>주문명</dt>
          <dd>{payment.orderName}</dd>
        </div>
        <div>
          <dt>결제 금액</dt>
          <dd>{formatPrice(payment.amount)}원</dd>
        </div>
        <div>
          <dt>에스크로</dt>
          <dd>{payment.escrowReleased ? '정산 완료' : '보호 중'}</dd>
        </div>
      </dl>
      {receiptQuery.data?.receiptUrl ? (
        <a href={receiptQuery.data.receiptUrl} rel="noreferrer" target="_blank">
          <FileText size={16} />
          영수증 열기
        </a>
      ) : null}
    </section>
  );
}

async function requestTossCheckout(payment: Payment) {
  const tossPayments = await loadTossPayments(payment.checkout.clientKey);
  const tossPayment = tossPayments.payment({ customerKey: payment.checkout.customerKey });
  await tossPayment.requestPayment({
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: payment.checkout.amount,
    },
    orderId: payment.checkout.orderId,
    orderName: payment.checkout.orderName,
    successUrl: withPaymentId(payment.checkout.successUrl, payment.id),
    failUrl: withPaymentId(payment.checkout.failUrl, payment.id),
    card: {
      useEscrow: true,
    },
  });
}

function withPaymentId(url: string, paymentId: string): string {
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set('paymentId', paymentId);
  return nextUrl.toString();
}

function parseRole(value: string | null): TransactionRole {
  if (value === 'buyer' || value === 'seller') {
    return value;
  }

  return 'all';
}

function parseStatus(value: string | null): TransactionStatus | undefined {
  return TX_STATUSES.find((status) => status === value);
}

function nextParams({
  role,
  status,
}: {
  role: string;
  status?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (role && role !== 'all') params.set('role', role);
  if (status) params.set('status', status);
  return params;
}

function isStatusReached(current: TransactionStatus, target: TransactionStatus): boolean {
  return TX_STATUSES.indexOf(current) >= TX_STATUSES.indexOf(target);
}
