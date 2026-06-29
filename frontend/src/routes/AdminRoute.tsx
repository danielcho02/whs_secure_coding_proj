import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ErrorState } from '../ui/StateViews';

export function AdminRoute() {
  const { isAdmin, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="route-loading">
        <div className="route-loading__mark" />
        <p>권한을 확인하고 있습니다</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (!isAdmin) {
    return (
      <ErrorState
        description="관리자 권한이 필요한 화면입니다."
        title="이 작업을 할 권한이 없습니다"
      />
    );
  }

  return <Outlet />;
}
