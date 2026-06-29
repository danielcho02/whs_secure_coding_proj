import { useQuery } from '@tanstack/react-query';
import { Flag, ShieldCheck } from 'lucide-react';
import { listMyReports } from '../api/reports';
import { toFriendlyError } from '../api/errors';
import {
  formatDateTime,
  reportStatusLabel,
  reportTargetLabel,
} from '../lib/format';
import { EmptyState, ErrorState } from '../ui/StateViews';

export function ReportsPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: () => listMyReports({ limit: 50 }),
  });
  const reports = reportsQuery.data?.items ?? [];

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">신고 내역</p>
          <h1 id="reports-title">내 신고 내역</h1>
        </div>
      </header>

      {reportsQuery.isError ? (
        <ErrorState
          description={toFriendlyError(reportsQuery.error).message}
          onAction={() => void reportsQuery.refetch()}
          title="신고 내역을 불러오지 못했습니다"
        />
      ) : null}
      {reportsQuery.isLoading ? <div className="timeline-list is-loading" /> : null}
      {!reportsQuery.isLoading && !reportsQuery.isError && reports.length === 0 ? (
        <EmptyState
          description="상품, 사용자, 채팅에서 신고를 접수하면 처리 상태가 이곳에 표시됩니다."
          title="접수된 신고가 없습니다"
        />
      ) : null}
      {reports.length > 0 ? (
        <div className="timeline-list">
          {reports.map((report) => (
            <article className="timeline-item" key={report.id}>
              <span className={`timeline-item__dot status-${report.status.toLowerCase()}`}>
                {report.status === 'RESOLVED' ? <ShieldCheck size={16} /> : <Flag size={16} />}
              </span>
              <div>
                <div className="timeline-item__meta">
                  <span>{reportTargetLabel(report.targetType)}</span>
                  <time>{formatDateTime(report.createdAt)}</time>
                </div>
                <h2>{report.reason}</h2>
                {report.description ? <p>{report.description}</p> : null}
                <strong>{reportStatusLabel(report.status)}</strong>
                {report.adminNote ? <em>{report.adminNote}</em> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
