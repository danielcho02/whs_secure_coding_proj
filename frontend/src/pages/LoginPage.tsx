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
  const showDemoLogin = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
  // VITE_* values are bundled into the browser; this is dev/demo QA data only.
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD?.trim() ?? '';
  const canUseDemoLogin = demoPassword.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ email, password });
      showToast('동네결에 다시 오신 걸 환영합니다.', 'success');
      navigate(from, { replace: true });
    } catch (error) {
      showToast(getLoginErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    if (!canUseDemoLogin) {
      showToast('시연 비밀번호가 설정되지 않았습니다.', 'info');
      return;
    }

    setDemoLoading(demoEmail);

    try {
      await login({ email: demoEmail, password: demoPassword });
      showToast('시연 계정으로 로그인했습니다.', 'success');
      navigate(from, { replace: true });
    } catch (error) {
      showToast(
        getLoginErrorMessage(error, {
          suspendedDemo: demoEmail === 'suspended@example.com',
        }),
        'error',
      );
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <BrandLogo size="lg" />
          <h1 id="login-title">
            <span>우리 동네에서 이어지는</span>
            <span>안전한 중고거래</span>
          </h1>
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
              <small>
                {canUseDemoLogin
                  ? '시연 계정으로 실제 흐름을 확인할 수 있어요'
                  : '시연 비밀번호가 설정되지 않았습니다'}
              </small>
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
                  disabled={!canUseDemoLogin || demoLoading !== null}
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

function getLoginErrorMessage(
  error: unknown,
  options: { suspendedDemo?: boolean } = {},
): string {
  const friendly = toFriendlyError(error);

  if (!friendly.status) {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }

  if (friendly.status === 429 || friendly.code === 'RATE_LIMITED') {
    return '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.';
  }

  if (options.suspendedDemo) {
    return '이 시연 계정은 이용 제한 상태라 로그인되지 않습니다.';
  }

  return '이메일 또는 비밀번호가 올바르지 않습니다.';
}
