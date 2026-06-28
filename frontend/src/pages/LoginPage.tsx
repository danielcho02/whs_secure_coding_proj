import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, ShieldCheck, Store, UserRound, UserX } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { toFriendlyError } from '../api/errors';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const showDemoLogin =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ email, password });
      showToast('동네결에 다시 오신 걸 환영합니다.', 'success');
      navigate(from, { replace: true });
    } catch (error) {
      showToast(toFriendlyError(error).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    const devPassword = 'Password123!';
    setDemoLoading(demoEmail);

    try {
      await login({ email: demoEmail, password: devPassword });
      showToast('시연 계정으로 로그인했습니다.', 'success');
      navigate(from, { replace: true });
    } catch (error) {
      showToast(toFriendlyError(error).message, 'error');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <BrandLogo size="lg" />
          <h1 id="login-title">우리 동네에서 이어지는 안전한 중고거래</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>이메일</span>
            <span className="field__control">
              <Mail size={18} />
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </label>

          <label className="field">
            <span>비밀번호</span>
            <span className="field__control">
              <LockKeyhole size={18} />
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상"
                required
                type="password"
                value={password}
              />
            </span>
          </label>

          <Button className="auth-form__submit" loading={isSubmitting} type="submit">
            로그인
          </Button>
        </form>

        {showDemoLogin ? (
          <section className="demo-login" aria-label="시연 계정 로그인">
            <div className="demo-login__head">
              <span>시연 계정으로 빠르게 확인</span>
              <small>실제 로그인 API를 호출합니다</small>
            </div>
            <div className="demo-login__grid">
              {[
                { email: 'buyer@example.com', label: '구매자 체험', icon: UserRound },
                { email: 'seller@example.com', label: '판매자 체험', icon: Store },
                { email: 'admin@example.com', label: '관리자 체험', icon: ShieldCheck },
                { email: 'suspended@example.com', label: '정지 계정 확인', icon: UserX },
              ].map((account) => (
                <Button
                  icon={<account.icon size={17} />}
                  key={account.email}
                  loading={demoLoading === account.email}
                  onClick={() => void handleDemoLogin(account.email)}
                  variant="secondary"
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        <p className="auth-switch">
          처음 이용하시나요? <Link to="/register">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
