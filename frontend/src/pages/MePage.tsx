import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Edit3,
  ExternalLink,
  Heart,
  HeartOff,
  LogOut,
  Package,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import {
  listMyProducts,
  toggleFavorite,
  type Product,
  type ProductStatus,
} from '../api/products';
import { toFriendlyError } from '../api/errors';
import { listMyFavorites, updateMe } from '../api/users';
import { useAuth } from '../auth/useAuth';
import {
  formatPrice,
  formatRelativeTime,
  productStatusLabel,
  userStatusLabel,
} from '../lib/format';
import { Button } from '../ui/Button';
import { ImageFallback } from '../ui/ImageFallback';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function MePage() {
  const { logout, syncUser, user } = useAuth();
  const { showToast } = useToast();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
    setBio(user?.bio ?? '');
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (updatedUser) => {
      syncUser(updatedUser);
      setIsEditing(false);
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
          <span>완료 거래와 안전 활동 기반</span>
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

      <section className="profile-view" aria-label="프로필 정보">
        <div>
          <h2>소개</h2>
          <p>{user.bio?.trim() || '아직 작성한 소개가 없습니다.'}</p>
        </div>
        <Button
          aria-expanded={isEditing}
          aria-controls="profile-edit-form"
          className="profile-edit-toggle"
          icon={<Edit3 size={17} />}
          onClick={() => setIsEditing((current) => !current)}
          type="button"
          variant="secondary"
        >
          {isEditing ? '편집 닫기' : '프로필 수정'}
        </Button>
      </section>

      {isEditing ? (
        <form
          className="profile-edit"
          id="profile-edit-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            updateMutation.mutate({
              nickname: nickname.trim(),
              bio: bio.trim(),
              avatarUrl: user.avatarUrl ?? undefined,
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
          <Button loading={updateMutation.isPending} type="submit">
            저장
          </Button>
        </form>
      ) : null}

      <section className="profile-account-actions" aria-label="계정 작업">
        <Button
          icon={<LogOut size={17} />}
          onClick={async () => {
            await logout();
            showToast('로그아웃했습니다.', 'success');
          }}
          variant="secondary"
        >
          로그아웃
        </Button>
      </section>
    </section>
  );
}

export function MyProductsPage() {
  const productsQuery = useQuery({
    queryKey: ['products', { mine: true }],
    queryFn: () => listMyProducts({ limit: 100 }),
  });
  const myProducts = useMemo(
    () => productsQuery.data?.items ?? [],
    [productsQuery.data?.items],
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
              <MyProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function FavoritesPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: () => listMyFavorites({ limit: 100 }),
  });
  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('찜 목록을 업데이트했습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });
  const favorites = favoritesQuery.data?.items ?? [];

  return (
    <section className="favorites-page" aria-labelledby="favorites-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">찜</p>
          <h1 id="favorites-title">관심 상품</h1>
        </div>
      </header>
      {favoritesQuery.isError ? (
        <ErrorState
          description={toFriendlyError(favoritesQuery.error).message}
          onAction={() => void favoritesQuery.refetch()}
          title="찜 목록을 불러오지 못했습니다"
        />
      ) : null}
      {!favoritesQuery.isLoading && !favoritesQuery.isError && favorites.length === 0 ? (
        <EmptyState
          description="마음에 드는 상품의 찜 버튼을 누르면 이곳에서 한 번에 볼 수 있습니다."
          title="아직 찜한 상품이 없습니다"
        />
      ) : null}
      {favorites.length > 0 ? (
        <div className="photo-shelf photo-shelf--favorites">
          {favorites.map((product) => (
            <FavoriteProductCard
              key={product.id}
              loading={favoriteMutation.isPending}
              onRemove={(productId) => favoriteMutation.mutate(productId)}
              product={product}
            />
          ))}
        </div>
      ) : favoritesQuery.isLoading ? (
        <div className="photo-shelf is-loading" />
      ) : null}
    </section>
  );
}

function MyProductCard({ product }: { product: Product }) {
  const isPubliclyVisible = isPublicProductStatus(product.status);

  return (
    <article className="photo-shelf__card">
      <Link className="photo-shelf__main" to={`/products/${product.id}/edit`}>
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          src={product.images[0]?.url}
          title={product.title}
        />
        <strong>{product.title}</strong>
        <span>{formatPrice(product.price)}원</span>
      </Link>
      <div className="photo-shelf__meta">
        <span>{productStatusLabel(product.status)}</span>
        <span>{product.region ?? '동네 미정'} · {formatRelativeTime(product.createdAt)}</span>
        {isPubliclyVisible ? (
          <Link className="button button--quiet" to={`/products/${product.id}`}>
            <ExternalLink size={15} />
            <span>상품 페이지 보기</span>
          </Link>
        ) : (
          <small>숨김 상태 · 편집만 가능</small>
        )}
      </div>
    </article>
  );
}

function FavoriteProductCard({
  loading,
  onRemove,
  product,
}: {
  loading: boolean;
  onRemove: (productId: string) => void;
  product: Product;
}) {
  return (
    <article className="photo-shelf__card">
      <Link className="photo-shelf__main" to={`/products/${product.id}`}>
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          src={product.images[0]?.url}
          title={product.title}
        />
        <strong>{product.title}</strong>
        <span>{formatPrice(product.price)}원</span>
      </Link>
      <div className="photo-shelf__meta">
        <span>{productStatusLabel(product.status)}</span>
        <span>{product.region ?? '동네 미정'} · {formatRelativeTime(product.createdAt)}</span>
        <Button
          disabled={loading}
          icon={<HeartOff size={15} />}
          onClick={() => onRemove(product.id)}
          variant="quiet"
        >
          찜 해제
        </Button>
      </div>
    </article>
  );
}

function isPublicProductStatus(status: ProductStatus): boolean {
  return status === 'ON_SALE' || status === 'RESERVED' || status === 'SOLD';
}
