import {
  Bell,
  Heart,
  Home,
  LogIn,
  MessageCircle,
  Package,
  ShieldCheck,
  User,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Button } from '../ui/Button';

const primaryNav = [
  { to: '/', label: '홈', icon: Home },
  { to: '/favorites', label: '찜', icon: Heart },
  { to: '/chats', label: '채팅', icon: MessageCircle },
  { to: '/transactions', label: '거래', icon: Package },
  { to: '/me', label: '마이', icon: User },
];

export function AppShell() {
  const { isAdmin, logout, status, user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-frame">
      <aside className="desktop-rail" aria-label="주요 메뉴">
        <button className="brand-lockup" onClick={() => navigate('/')} type="button">
          <span className="brand-lockup__symbol">결</span>
          <span>
            <strong>동네결</strong>
            <small>안전한 중고거래</small>
          </span>
        </button>

        <nav className="desktop-rail__nav">
          {primaryNav.map((item) => (
            <NavLink className="nav-item" end={item.to === '/'} key={item.to} to={item.to}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink className="nav-item" to="/notifications">
            <Bell size={20} />
            <span>알림</span>
          </NavLink>
          {isAdmin ? (
            <NavLink className="nav-item nav-item--admin" to="/admin">
              <ShieldCheck size={20} />
              <span>관리</span>
            </NavLink>
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
            <span className="brand-lockup__symbol">결</span>
            <span>
              <strong>동네결</strong>
              <small>우리 동네에서 이어지는 안전한 중고거래</small>
            </span>
          </button>
          <button className="mobile-topbar__bell" onClick={() => navigate('/notifications')} type="button">
            <Bell size={20} />
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
