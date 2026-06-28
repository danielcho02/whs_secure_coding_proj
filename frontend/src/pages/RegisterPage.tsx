import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { toFriendlyError } from '../api/errors';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';

export function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await register({ email, nickname, password });
      showToast('동네결 가입이 완료되었습니다.', 'success');
      navigate('/', { replace: true });
    } catch (error) {
      showToast(toFriendlyError(error).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel auth-panel--register" aria-labelledby="register-title">
        <div className="auth-brand">
          <BrandLogo size="lg" tagline="동네결 시작하기" />
          <h1 id="register-title">거래 정보는 선명하게, 계정은 안전하게.</h1>
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
            <span>닉네임</span>
            <span className="field__control">
              <UserRound size={18} />
              <input
                autoComplete="nickname"
                maxLength={30}
                minLength={2}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="동네에서 보일 이름"
                required
                type="text"
                value={nickname}
              />
            </span>
          </label>

          <label className="field">
            <span>비밀번호</span>
            <span className="field__control">
              <LockKeyhole size={18} />
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="대소문자, 숫자, 특수문자 포함"
                required
                type="password"
                value={password}
              />
            </span>
          </label>

          <Button className="auth-form__submit" loading={isSubmitting} type="submit">
            가입하고 둘러보기
          </Button>
        </form>

        <p className="auth-switch">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}
