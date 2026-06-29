import {
  Bell,
  Heart,
  Home,
  LogIn,
  MessageCircle,
  Package,
  PackagePlus,
  ScrollText,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { listNotifications } from '../api/notifications';
import { useAuth } from '../auth/useAuth';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';

const primaryNav = [
  { to: '/', label: '홈', icon: Home },
  { to: '/favorites', label: '찜', icon: Heart },
  { to: '/chats', label: '채팅', icon: MessageCircle },
  { to: '/transactions', label: '거래', icon: Package },
  { to: '/me/products', label: '내 판매글', icon: ScrollText },
  { to: '/me', label: '마이', icon: User },
];

const adminNav = [
  { to: '/admin/reports', label: '신고 큐' },
  { to: '/admin/products', label: '상품 관리' },
  { to: '/admin/users', label: '사용자' },
  { to: '/admin/logs', label: '운영 로그' },
];

export function AppShell() {
  const { isAdmin, logout, status, user } = useAuth();
  const navigate = useNavigate();
  const unreadQuery = useQuery({
    enabled: status === 'authenticated',
    queryKey: ['notifications', { unreadOnly: true, shell: true }],
    queryFn: () => listNotifications({ limit: 1, unreadOnly: true }),
    refetchInterval: 45_000,
  });
  const unreadCount = unreadQuery.data?.total ?? 0;

  return (
    <div className="app-frame">
      <aside className="desktop-rail" aria-label="주요 메뉴">
        <button className="brand-lockup" onClick={() => navigate('/')} type="button">
          <BrandLogo compact={false} />
        </button>

        <nav className="desktop-rail__nav">
          {primaryNav.map((item) => (
            <NavLink className="nav-item" end={item.to === '/'} key={item.to} to={item.to}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink className="nav-item" to="/notifications">
            <span className="nav-item__icon">
              <Bell size={20} />
              {unreadCount > 0 ? <i>{Math.min(unreadCount, 99)}</i> : null}
            </span>
            <span>알림</span>
          </NavLink>
          {status === 'authenticated' ? (
            <NavLink className="nav-item nav-item--sell" to="/products/new">
              <PackagePlus size={20} />
              <span>판매하기</span>
            </NavLink>
          ) : null}
          {isAdmin ? (
            <div className="admin-nav-group">
              <NavLink className="nav-item nav-item--admin" to="/admin">
                <ShieldCheck size={20} />
                <span>관리</span>
              </NavLink>
              {adminNav.map((item) => (
                <NavLink className="admin-subnav" key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </nav>

        <div className="desktop-rail__account">
          {status === 'authenticated' && user ? (
            <>
              <div className="account-chip">
                <span className="account-chip__avatar">
                  {user.nickname.slice(0, 1)}
                </span>
                <span>
                  <strong>{user.nickname}</strong>
                  <small>{user.role === 'ADMIN' ? '관리자' : '동네 이웃'}</small>
                </span>
              </div>
              <Button onClick={logout} variant="quiet">
                로그아웃
              </Button>
            </>
          ) : (
            <Button icon={<LogIn size={17} />} onClick={() => navigate('/login')} variant="secondary">
              로그인
            </Button>
          )}
        </div>
      </aside>

      <div className="app-frame__content">
        <header className="mobile-topbar">
          <button className="brand-lockup brand-lockup--mobile" onClick={() => navigate('/')} type="button">
            <BrandLogo size="sm" />
          </button>
          <button className="mobile-topbar__bell" onClick={() => navigate('/notifications')} type="button">
            <Bell size={20} />
            {unreadCount > 0 ? <i>{Math.min(unreadCount, 99)}</i> : null}
            <span className="sr-only">알림</span>
          </button>
        </header>

        {user && user.status !== 'ACTIVE' ? (
          <div className="status-ribbon">
            현재 계정 상태는 {user.status}입니다. 일부 변경 기능이 제한될 수 있습니다.
          </div>
        ) : null}

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-tabbar" aria-label="하단 메뉴">
        {primaryNav.map((item) => (
          <NavLink className="mobile-tabbar__item" end={item.to === '/'} key={item.to} to={item.to}>
            <item.icon size={21} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
