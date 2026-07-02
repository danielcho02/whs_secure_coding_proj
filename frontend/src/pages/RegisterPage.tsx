import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, LockKeyhole, Mail, UserRound } from 'lucide-react';
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
  const passwordRules = getPasswordRules(password);

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
          <h1 id="register-title">동네결을 시작해보세요.</h1>
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
                placeholder="이메일 주소"
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
                placeholder="예: 마포구 전자왕"
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
            <ul className="password-rules" aria-label="비밀번호 조건">
              {passwordRules.map((rule) => (
                <li className={rule.valid ? 'is-valid' : ''} key={rule.label}>
                  <CheckCircle2 size={14} />
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
          </label>

          <Button className="auth-form__submit" loading={isSubmitting} type="submit">
            가입하기
          </Button>
        </form>

        <p className="auth-switch">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}

function getPasswordRules(password: string): Array<{ label: string; valid: boolean }> {
  return [
    { label: '8자 이상', valid: password.length >= 8 },
    { label: '대문자와 소문자 포함', valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: '숫자와 특수문자 포함', valid: /\d/.test(password) && /[^A-Za-z0-9]/.test(password) },
  ];
}
