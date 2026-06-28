import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart, Package, ShieldCheck, UserCog } from 'lucide-react';
import { listProducts } from '../api/products';
import { toFriendlyError } from '../api/errors';
import { updateMe } from '../api/users';
import { useAuth } from '../auth/useAuth';
import { formatPrice, productStatusLabel, userStatusLabel } from '../lib/format';
import { Button } from '../ui/Button';
import { ImageFallback } from '../ui/ImageFallback';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function MePage() {
  const { refresh, user } = useAuth();
  const { showToast } = useToast();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');

  useEffect(() => {
    setNickname(user?.nickname ?? '');
    setBio(user?.bio ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      await refresh();
      showToast('프로필을 저장했습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  if (!user) {
    return <EmptyState title="로그인이 필요합니다" />;
  }

  return (
    <section className="me-page" aria-labelledby="me-title">
      <header className="profile-summary">
        <div className="user-avatar user-avatar--large">
          {user.avatarUrl ? <img alt="" src={user.avatarUrl} /> : user.nickname.slice(0, 1)}
        </div>
        <div>
          <p className="section-kicker">마이페이지</p>
          <h1 id="me-title">{user.nickname}</h1>
          <span className={`status-pill status-${user.status.toLowerCase()}`}>
            {userStatusLabel(user.status)}
          </span>
        </div>
      </header>

      {user.status !== 'ACTIVE' ? (
        <section className="account-warning">
          <ShieldCheck size={20} />
          <p>현재 계정 상태 때문에 채팅, 결제, 판매글 변경이 제한될 수 있습니다.</p>
        </section>
      ) : null}

      <div className="profile-stats">
        <div>
          <strong>{user.trustScore ?? 0}</strong>
          <span>신뢰도</span>
        </div>
        <div>
          <strong>{user.completedTx ?? 0}</strong>
          <span>완료 거래</span>
        </div>
        <Link to="/me/products">
          <Package size={18} />
          내 상품
        </Link>
        <Link to="/favorites">
          <Heart size={18} />
          찜
        </Link>
      </div>

      <form
        className="profile-edit"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          updateMutation.mutate({
            nickname: nickname.trim(),
            bio: bio.trim(),
            avatarUrl: avatarUrl.trim() || undefined,
          });
        }}
      >
        <h2>
          <UserCog size={19} />
          프로필 편집
        </h2>
        <label className="field">
          <span>닉네임</span>
          <input
            maxLength={30}
            minLength={2}
            onChange={(event) => setNickname(event.target.value)}
            value={nickname}
          />
        </label>
        <label className="field">
          <span>소개</span>
          <textarea
            maxLength={500}
            onChange={(event) => setBio(event.target.value)}
            value={bio ?? ''}
          />
        </label>
        <label className="field">
          <span>아바타 URL</span>
          <input
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
            value={avatarUrl ?? ''}
          />
        </label>
        <Button loading={updateMutation.isPending} type="submit">
          저장
        </Button>
      </form>
    </section>
  );
}

export function MyProductsPage() {
  const { user } = useAuth();
  const productsQuery = useQuery({
    queryKey: ['products', { mine: true }],
    queryFn: () => listProducts({ limit: 100 }),
  });
  const myProducts = useMemo(
    () => (productsQuery.data?.items ?? []).filter((product) => product.seller.id === user?.id),
    [productsQuery.data?.items, user?.id],
  );
  const grouped = useMemo(
    () =>
      myProducts.reduce<Record<string, typeof myProducts>>((groups, product) => {
        groups[product.status] = [...(groups[product.status] ?? []), product];
        return groups;
      }, {}),
    [myProducts],
  );

  return (
    <section className="my-products-page" aria-labelledby="my-products-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">내 상품</p>
          <h1 id="my-products-title">상태별 판매글</h1>
        </div>
        <Link className="button button--primary" to="/products/new">
          판매글 등록
        </Link>
      </header>

      {productsQuery.isError ? (
        <ErrorState
          description={toFriendlyError(productsQuery.error).message}
          onAction={() => void productsQuery.refetch()}
          title="내 상품을 불러오지 못했습니다"
        />
      ) : null}
      {!productsQuery.isLoading && !productsQuery.isError && myProducts.length === 0 ? (
        <EmptyState
          description="첫 판매글을 등록하면 상태별로 관리할 수 있습니다."
          title="등록한 상품이 없습니다"
        />
      ) : null}
      {Object.entries(grouped).map(([status, products]) => (
        <section className="product-status-group" key={status}>
          <h2>{productStatusLabel(status)}</h2>
          <div className="photo-shelf">
            {products.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <ImageFallback
                  alt={`${product.title} 상품 사진`}
                  src={product.images[0]?.url}
                  title={product.title}
                  category={product.category}
                />
                <strong>{product.title}</strong>
                <span>{formatPrice(product.price)}원</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function FavoritesPage() {
  return (
    <section className="favorites-page" aria-labelledby="favorites-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">찜</p>
          <h1 id="favorites-title">관심 상품</h1>
        </div>
      </header>
      <EmptyState
        description="현재 백엔드에는 내가 찜한 상품을 조회하는 API가 없습니다. 목록을 가짜로 채우지 않고 필요한 API가 준비되면 photo shelf로 연결합니다."
        title="찜 목록 API가 필요합니다"
      />
    </section>
  );
}
