import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';

export function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast('비밀번호 재설정 기능은 준비 중입니다.', 'info');
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="forgot-password-title">
        <div className="auth-brand">
          <BrandLogo size="lg" tagline="계정 찾기" />
          <h1 id="forgot-password-title">비밀번호 재설정</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>가입 이메일</span>
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

          <p className="auth-form__hint">
            이메일 발송 기능은 아직 준비 중입니다. 입력한 주소는 저장하거나 전송하지 않습니다.
          </p>

          <Button className="auth-form__submit" icon={<LockKeyhole size={17} />} type="submit">
            재설정 안내 확인
          </Button>
        </form>

        <p className="auth-switch">
          비밀번호가 기억나셨나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}
