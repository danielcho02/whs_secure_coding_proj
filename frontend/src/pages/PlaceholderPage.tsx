import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../ui/StateViews';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <EmptyState
      actionLabel="홈으로 이동"
      description={description}
      onAction={() => navigate('/')}
      title={title}
    />
  );
}

export function AdminHomePage() {
  return (
    <section className="admin-preview" aria-labelledby="admin-preview-title">
      <div className="page-head">
        <div>
          <p className="section-kicker">관리자</p>
          <h1 id="admin-preview-title">신고 처리 큐</h1>
        </div>
      </div>
      <div className="admin-preview__layout">
        <aside className="admin-preview__queue">
          <span className="queue-pill">PENDING</span>
          <strong>신고 관리 화면은 다음 단계에서 API와 연결됩니다.</strong>
          <p>표 중심 템플릿 대신 처리 큐와 상세 패널 구조로 확장할 자리입니다.</p>
        </aside>
        <section className="admin-preview__detail">
          <span>선택된 신고</span>
          <h2>상세 패널</h2>
          <p>관리자 전용 라우트와 네비게이션 렌더링은 role 기반으로 이미 보호됩니다.</p>
        </section>
      </div>
    </section>
  );
}
