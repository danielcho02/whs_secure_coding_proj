import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EyeOff,
  ListFilter,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import {
  getAdminReport,
  hideAdminProduct,
  listAdminLogs,
  listAdminProducts,
  listAdminReports,
  listAdminUsers,
  restoreAdminProduct,
  restoreAdminUser,
  suspendAdminUser,
  updateAdminReportStatus,
  type AdminProduct,
  type AdminReport,
  type AdminUser,
} from '../api/admin';
import { toFriendlyError } from '../api/errors';
import type { ReportStatus } from '../api/reports';
import {
  adminActionLabel,
  formatDateTime,
  formatPrice,
  productStatusLabel,
  reportStatusLabel,
  reportTargetLabel,
  userStatusLabel,
} from '../lib/format';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { ImageFallback } from '../ui/ImageFallback';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

type AdminAction =
  | { type: 'report'; id: string; status: Exclude<ReportStatus, 'PENDING'> }
  | { type: 'hideProduct'; product: AdminProduct }
  | { type: 'restoreProduct'; product: AdminProduct }
  | { type: 'suspendUser'; user: AdminUser }
  | { type: 'restoreUser'; user: AdminUser };

export function AdminDashboardPage() {
  const reportsQuery = useQuery({
    queryKey: ['adminReports', { status: 'PENDING', dashboard: true }],
    queryFn: () => listAdminReports({ status: 'PENDING', limit: 6 }),
  });
  const logsQuery = useQuery({
    queryKey: ['adminLogs', { dashboard: true }],
    queryFn: () => listAdminLogs({ limit: 6 }),
  });

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <header className="admin-hero">
        <BrandLogo />
        <div>
          <p className="section-kicker">운영 콘솔</p>
          <h1 id="admin-title">오늘 처리할 안전 큐</h1>
        </div>
      </header>
      <div className="admin-dashboard-grid">
        <section className="admin-queue-panel">
          <h2>대기 중 신고</h2>
          <AdminReportQueue reports={reportsQuery.data?.items ?? []} />
        </section>
        <section className="admin-queue-panel">
          <h2>최근 조치</h2>
          <AdminLogTimeline logs={logsQuery.data?.items ?? []} />
        </section>
      </div>
    </section>
  );
}

export function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus | undefined>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<AdminAction | null>(null);
  const reportsQuery = useQuery({
    queryKey: ['adminReports', { status }],
    queryFn: () => listAdminReports({ status, limit: 50 }),
  });
  const selectedReportQuery = useQuery({
    enabled: Boolean(selectedId),
    queryKey: ['adminReport', selectedId],
    queryFn: () => getAdminReport(selectedId ?? ''),
  });

  const selectedReport = selectedReportQuery.data ?? reportsQuery.data?.items[0] ?? null;

  return (
    <section className="admin-workspace" aria-labelledby="admin-reports-title">
      <AdminSectionHead title="신고 큐" subtitle="우선순위가 높은 안전 요청부터 처리합니다." />
      <div className="filter-rail">
        {(['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'] as ReportStatus[]).map((item) => (
          <button
            className={status === item ? 'is-selected' : ''}
            key={item}
            onClick={() => setStatus(item)}
            type="button"
          >
            {reportStatusLabel(item)}
          </button>
        ))}
      </div>
      <div className="admin-split">
        <AdminReportQueue
          onSelect={setSelectedId}
          reports={reportsQuery.data?.items ?? []}
          selectedId={selectedReport?.id}
        />
        <AdminReportDetail
          loading={selectedReportQuery.isLoading}
          onAction={(nextStatus) =>
            selectedReport && setAction({ type: 'report', id: selectedReport.id, status: nextStatus })
          }
          report={selectedReport}
        />
      </div>
      <AdminActionDrawer action={action} onClose={() => setAction(null)} />
    </section>
  );
}

export function AdminProductsPage() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [action, setAction] = useState<AdminAction | null>(null);
  const productsQuery = useQuery({
    queryKey: ['adminProducts', { q }],
    queryFn: () => listAdminProducts({ q: q || undefined, limit: 50 }),
  });
  const products = productsQuery.data?.items ?? [];
  const active = selected ?? products[0] ?? null;

  return (
    <section className="admin-workspace" aria-labelledby="admin-products-title">
      <AdminSectionHead title="상품 모더레이션" subtitle="숨김 상태와 판매 상태를 함께 확인합니다." />
      <AdminSearch value={q} onChange={setQ} />
      <div className="admin-split">
        <div className="admin-result-list">
          {!productsQuery.isLoading && products.length === 0 ? (
            <EmptyState title="검색 결과가 없습니다" description="검색어를 줄이거나 다른 상품명으로 찾아보세요." />
          ) : null}
          {products.map((product) => (
            <button
              className={active?.id === product.id ? 'is-selected' : ''}
              key={product.id}
              onClick={() => setSelected(product)}
              type="button"
            >
              <ImageFallback
                alt={`${product.title} 상품 사진`}
                category={product.category}
                className="admin-product-thumb"
                src={product.thumbnailUrl}
                title={product.title}
              />
              <div className="admin-result-list__copy">
                <strong>{product.title}</strong>
                <span>
                  {formatPrice(product.price)}원 · {productStatusLabel(product.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
        <AdminProductDetail
          onAction={setAction}
          product={active}
        />
      </div>
      <AdminActionDrawer action={action} onClose={() => setAction(null)} />
    </section>
  );
}

export function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<AdminAction | null>(null);
  const usersQuery = useQuery({
    queryKey: ['adminUsers', { q }],
    queryFn: () => listAdminUsers({ q: q || undefined, limit: 50 }),
  });
  const users = usersQuery.data?.items ?? [];
  const active = selected ?? users[0] ?? null;

  return (
    <section className="admin-workspace" aria-labelledby="admin-users-title">
      <AdminSectionHead title="사용자 상태" subtitle="정지와 복구는 사유를 남기고 처리합니다." />
      <AdminSearch value={q} onChange={setQ} />
      <div className="admin-split">
        <div className="admin-result-list">
          {!usersQuery.isLoading && users.length === 0 ? (
            <EmptyState title="검색 결과가 없습니다" description="닉네임이나 상태 검색어를 다시 확인해주세요." />
          ) : null}
          {users.map((user) => (
            <button
              className={active?.id === user.id ? 'is-selected' : ''}
              key={user.id}
              onClick={() => setSelected(user)}
              type="button"
            >
              <strong>{user.nickname}</strong>
              <span>
                {adminRoleLabel(user.role)} · {userStatusLabel(user.status)}
              </span>
            </button>
          ))}
        </div>
        <AdminUserDetail onAction={setAction} user={active} />
      </div>
      <AdminActionDrawer action={action} onClose={() => setAction(null)} />
    </section>
  );
}

export function AdminLogsPage() {
  const logsQuery = useQuery({
    queryKey: ['adminLogs'],
    queryFn: () => listAdminLogs({ limit: 80 }),
  });

  return (
    <section className="admin-workspace" aria-labelledby="admin-logs-title">
      <AdminSectionHead title="운영 로그" subtitle="관리자 조치 이력을 읽기 전용으로 확인합니다." />
      {logsQuery.isError ? (
        <ErrorState
          description={toFriendlyError(logsQuery.error).message}
          onAction={() => void logsQuery.refetch()}
          title="운영 로그를 불러오지 못했습니다"
        />
      ) : null}
      <AdminLogTimeline logs={logsQuery.data?.items ?? []} />
    </section>
  );
}

function AdminSectionHead({ subtitle, title }: { title: string; subtitle: string }) {
  return (
    <header className="page-head">
      <div>
        <p className="section-kicker">Admin</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
    </header>
  );
}

function AdminSearch({
  onChange,
  value,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-search">
      <ListFilter size={18} />
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder="제목, 닉네임, 상태 검색"
        value={value}
      />
    </label>
  );
}

function AdminReportQueue({
  onSelect,
  reports,
  selectedId,
}: {
  reports: AdminReport[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState title="대기 중인 항목이 없습니다" />;
  }

  return (
    <div className="admin-queue">
      {reports.map((report) => (
        <button
          className={selectedId === report.id ? 'is-selected' : ''}
          key={report.id}
          onClick={() => onSelect?.(report.id)}
          type="button"
        >
          <span>{reportTargetLabel(report.targetType)}</span>
          <strong>{report.reason}</strong>
          <small>
            {report.reporter.nickname} · {formatDateTime(report.createdAt)}
          </small>
        </button>
      ))}
    </div>
  );
}

function AdminReportDetail({
  loading,
  onAction,
  report,
}: {
  report: AdminReport | null;
  loading: boolean;
  onAction: (status: Exclude<ReportStatus, 'PENDING'>) => void;
}) {
  if (loading) {
    return <section className="admin-detail is-loading" />;
  }

  if (!report) {
    return <EmptyState title="선택된 신고가 없습니다" />;
  }

  return (
    <section className="admin-detail">
      <span className={`status-pill status-${report.status.toLowerCase()}`}>
        {reportStatusLabel(report.status)}
      </span>
      <h2>{report.reason}</h2>
      <p>{report.description ?? '상세 설명 없음'}</p>
      <dl>
        <div>
          <dt>대상</dt>
          <dd>
            {reportTargetLabel(report.targetType)} · {describeAdminTarget(report.target)}
          </dd>
        </div>
        <div>
          <dt>신고자</dt>
          <dd>{report.reporter.nickname}</dd>
        </div>
        <div>
          <dt>접수</dt>
          <dd>{formatDateTime(report.createdAt)}</dd>
        </div>
      </dl>
      <div className="action-grid">
        <Button icon={<ShieldAlert size={17} />} onClick={() => onAction('REVIEWING')} variant="secondary">
          검토 중
        </Button>
        <Button icon={<ShieldCheck size={17} />} onClick={() => onAction('RESOLVED')}>
          처리 완료
        </Button>
        <Button onClick={() => onAction('REJECTED')} variant="quiet">
          반려
        </Button>
      </div>
    </section>
  );
}

function AdminProductDetail({
  onAction,
  product,
}: {
  product: AdminProduct | null;
  onAction: (action: AdminAction) => void;
}) {
  if (!product) return <EmptyState title="선택된 상품이 없습니다" />;

  return (
    <section className="admin-detail">
      <div className="admin-product-summary">
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          className="admin-product-thumb admin-product-thumb--large"
          src={product.thumbnailUrl}
          title={product.title}
        />
        <div>
          <span className={`status-pill ${product.isHidden ? 'status-rejected' : 'status-resolved'}`}>
            {product.isHidden ? '숨김' : '노출'}
          </span>
          <h2>{product.title}</h2>
        </div>
      </div>
      <p>{product.description ?? '설명 없음'}</p>
      <dl>
        <div>
          <dt>가격</dt>
          <dd>{formatPrice(product.price)}원</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{productStatusLabel(product.status)}</dd>
        </div>
        <div>
          <dt>판매자</dt>
          <dd>{product.seller?.nickname ?? '확인 불가'}</dd>
        </div>
      </dl>
      <div className="action-grid">
        <Button
          icon={<EyeOff size={17} />}
          onClick={() => onAction({ type: 'hideProduct', product })}
          variant="danger"
        >
          숨김
        </Button>
        <Button
          icon={<RotateCcw size={17} />}
          onClick={() => onAction({ type: 'restoreProduct', product })}
          variant="secondary"
        >
          복구
        </Button>
      </div>
    </section>
  );
}

function AdminUserDetail({
  onAction,
  user,
}: {
  user: AdminUser | null;
  onAction: (action: AdminAction) => void;
}) {
  if (!user) return <EmptyState title="선택된 사용자가 없습니다" />;

  return (
    <section className="admin-detail">
      <span className={`status-pill status-${user.status.toLowerCase()}`}>
        {userStatusLabel(user.status)}
      </span>
      <h2>{user.nickname}</h2>
      <p>{user.bio ?? '소개 없음'}</p>
      <dl>
        <div>
          <dt>권한</dt>
          <dd>{adminRoleLabel(user.role)}</dd>
        </div>
        <div>
          <dt>신뢰</dt>
          <dd>{user.trustScore}</dd>
        </div>
        <div>
          <dt>거래</dt>
          <dd>{user.completedTx}회</dd>
        </div>
      </dl>
      <div className="action-grid">
        <Button
          icon={<UserX size={17} />}
          onClick={() => onAction({ type: 'suspendUser', user })}
          variant="danger"
        >
          정지
        </Button>
        <Button
          icon={<RotateCcw size={17} />}
          onClick={() => onAction({ type: 'restoreUser', user })}
          variant="secondary"
        >
          복구
        </Button>
      </div>
    </section>
  );
}

function AdminActionDrawer({
  action,
  onClose,
}: {
  action: AdminAction | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const title = useMemo(() => actionTitle(action), [action]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error('ACTION_REQUIRED');
      if (action.type === 'report') {
        return updateAdminReportStatus(action.id, {
          status: action.status,
          adminNote: reason.trim() || undefined,
        });
      }
      if (action.type === 'hideProduct') {
        return hideAdminProduct(action.product.id, { reason: reason.trim() || undefined });
      }
      if (action.type === 'restoreProduct') {
        return restoreAdminProduct(action.product.id, { reason: reason.trim() || undefined });
      }
      if (action.type === 'suspendUser') {
        return suspendAdminUser(action.user.id, { reason: reason.trim() || undefined });
      }
      return restoreAdminUser(action.user.id, { reason: reason.trim() || undefined });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      await queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['adminLogs'] });
      setReason('');
      showToast('관리자 조치를 완료했습니다.', 'success');
      onClose();
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  return (
    <Drawer onClose={onClose} open={Boolean(action)} title={title}>
      <form
        className="admin-action-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="field">
          <span>사유 / 관리자 메모</span>
          <textarea
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            placeholder="조치 근거를 남겨주세요."
            value={reason}
          />
        </label>
        <Button loading={mutation.isPending} type="submit">
          조치 실행
        </Button>
      </form>
    </Drawer>
  );
}

function AdminLogTimeline({
  logs,
}: {
  logs: Array<{
    id: string;
    actor: { nickname: string };
    action: string;
    targetType: string;
    targetId: string;
    reason: string | null;
    createdAt: string;
  }>;
}) {
  if (logs.length === 0) {
    return <EmptyState title="표시할 로그가 없습니다" />;
  }

  return (
    <div className="timeline-list timeline-list--admin">
      {logs.map((log) => (
        <article className="timeline-item" key={log.id}>
          <span className="timeline-item__dot">
            <ShieldCheck size={15} />
          </span>
          <div>
            <div className="timeline-item__meta">
              <span>{log.actor.nickname}</span>
              <time>{formatDateTime(log.createdAt)}</time>
            </div>
            <h2>{adminActionLabel(log.action)}</h2>
            <p>
              {adminTargetLabel(log.targetType)} · {shortId(log.targetId)}
            </p>
            {log.reason ? <em>{log.reason}</em> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function describeAdminTarget(target: unknown): string {
  if (!target || typeof target !== 'object') {
    return '상세 정보 없음';
  }

  const record = target as Record<string, unknown>;
  for (const key of ['title', 'nickname', 'content', 'status']) {
    if (typeof record[key] === 'string' && record[key]) {
      return record[key];
    }
  }

  return '요약할 수 없는 대상';
}

function actionTitle(action: AdminAction | null): string {
  if (!action) return '관리자 조치';
  if (action.type === 'report') return '신고 상태 변경';
  if (action.type === 'hideProduct') return '상품 숨김';
  if (action.type === 'restoreProduct') return '상품 복구';
  if (action.type === 'suspendUser') return '사용자 정지';
  return '사용자 복구';
}

function adminRoleLabel(role: string): string {
  return role === 'ADMIN' ? '관리자' : '회원';
}

function adminTargetLabel(targetType: string): string {
  const labels: Record<string, string> = {
    PRODUCT: '상품',
    USER: '사용자',
    REPORT: '신고',
    CHAT: '채팅',
  };

  return labels[targetType] ?? '대상';
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}
