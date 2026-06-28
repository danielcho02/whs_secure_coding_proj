import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { EmptyState } from '../ui/StateViews';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="route-loading">
        <div className="route-loading__mark" />
        <p>세션을 확인하고 있습니다</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}

export function ActiveUserNotice() {
  return (
    <EmptyState
      description="계정 상태 때문에 일부 변경 기능이 제한됩니다. 필요한 정보 조회는 계속 이용할 수 있습니다."
      title="계정 상태를 확인해주세요"
    />
  );
}
