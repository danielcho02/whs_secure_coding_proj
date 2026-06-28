import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../ui/StateViews';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorState
      actionLabel="홈으로 이동"
      description="주소가 바뀌었거나 접근할 수 없는 항목일 수 있습니다."
      onAction={() => navigate('/')}
      title="존재하지 않거나 접근할 수 없는 항목입니다"
    />
  );
}
