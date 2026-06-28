import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { toFriendlyError } from '../api/errors';
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

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="brand-lockup__symbol">결</span>
          <div>
            <p>동네결</p>
            <h1 id="login-title">우리 동네에서 이어지는 안전한 중고거래</h1>
          </div>
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

        <p className="auth-switch">
          처음 이용하시나요? <Link to="/register">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
