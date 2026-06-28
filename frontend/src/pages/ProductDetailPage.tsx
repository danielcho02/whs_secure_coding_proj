import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Heart, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createChat } from '../api/chats';
import { toFriendlyError } from '../api/errors';
import { getProduct, toggleFavorite } from '../api/products';
import { useAuth } from '../auth/useAuth';
import { formatPrice, formatRelativeTime, productStatusLabel } from '../lib/format';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { ImageFallback } from '../ui/ImageFallback';
import { DetailSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { showToast } = useToast();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  const productQuery = useQuery({
    enabled: Boolean(productId),
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId ?? ''),
  });

  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
  });

  const chatMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (chat) => {
      showToast('채팅방을 열었습니다.', 'success');
      navigate(`/chats/${chat.id}`);
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const product = productQuery.data;
  const selectedImage = product?.images[selectedImageIndex]?.url ?? product?.images[0]?.url ?? null;
  const isOwner = Boolean(product && user?.id === product.seller.id);

  const handleFavorite = async () => {
    if (!product) {
      return;
    }

    if (status !== 'authenticated') {
      showToast('찜은 로그인 후 사용할 수 있습니다.', 'info');
      navigate('/login');
      return;
    }

    const previous = liked;
    setLiked(!previous);

    try {
      const result = await favoriteMutation.mutateAsync(product.id);
      setLiked(result.favorited);
    } catch (error) {
      setLiked(previous);
      showToast(toFriendlyError(error).message, 'error');
    }
  };

  const handleChat = () => {
    if (!product) {
      return;
    }

    if (status !== 'authenticated') {
      showToast('채팅은 로그인 후 시작할 수 있습니다.', 'info');
      navigate('/login');
      return;
    }

    chatMutation.mutate({ productId: product.id });
  };

  if (productQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (productQuery.isError || !product) {
    return (
      <ErrorState
        description={toFriendlyError(productQuery.error).message}
        onAction={() => void productQuery.refetch()}
        title="존재하지 않거나 접근할 수 없는 항목입니다"
      />
    );
  }

  return (
    <article className="detail-page">
      <div className="detail-topbar">
        <IconButton label="뒤로 가기" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <Link className="detail-topbar__home" to="/">
          동네결
        </Link>
      </div>

      <section className="detail-hero" aria-label="상품 사진">
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          className="detail-hero__image"
          src={selectedImage}
          title={product.title}
        />
        <span className={`status-chip status-chip--${statusClass(product.status)}`}>
          {productStatusLabel(product.status)}
        </span>
      </section>

      {product.images.length > 1 ? (
        <div className="image-strip" aria-label="상품 사진 선택">
          {product.images.map((image, index) => (
            <button
              aria-label={`${index + 1}번째 사진 보기`}
              className={selectedImageIndex === index ? 'is-selected' : ''}
              key={image.id}
              onClick={() => setSelectedImageIndex(index)}
              type="button"
            >
              <ImageFallback
                alt={`${product.title} 썸네일 ${index + 1}`}
                category={product.category}
                src={image.url}
                title={product.title}
              />
            </button>
          ))}
        </div>
      ) : null}

      <section className="detail-body">
        <div className="detail-title-row">
          <div>
            <p className="detail-category">{product.category}</p>
            <h1>{product.title}</h1>
          </div>
          <IconButton
            active={liked}
            className={`heart-button detail-heart ${liked ? 'heart-button--pop' : ''}`}
            disabled={favoriteMutation.isPending}
            label="찜하기"
            onClick={handleFavorite}
          >
            <Heart fill={liked ? 'currentColor' : 'none'} size={20} />
          </IconButton>
        </div>

        <div className="detail-price">{formatPrice(product.price)}원</div>
        <div className="detail-meta">
          <span>
            <MapPin size={15} />
            {product.region ?? '동네 미정'}
          </span>
          <span>{formatRelativeTime(product.createdAt)}</span>
          <span>조회 {product.viewCount}</span>
        </div>

        <section className="seller-band" aria-label="판매자 정보">
          <div className="seller-band__avatar">{product.seller.nickname.slice(0, 1)}</div>
          <div>
            <strong>{product.seller.nickname}</strong>
            <span>거래 {product.seller.completedTx}회 · 신뢰 {product.seller.trustScore}</span>
          </div>
          <ShieldCheck size={20} />
        </section>

        <section className="detail-description" aria-labelledby="description-title">
          <h2 id="description-title">상품 설명</h2>
          <p>{product.description}</p>
        </section>
      </section>

      <div className="sticky-action">
        <div>
          <span>{formatPrice(product.price)}원</span>
          <small>{productStatusLabel(product.status)}</small>
        </div>
        <Button
          disabled={isOwner || product.status !== 'ON_SALE'}
          icon={<MessageCircle size={18} />}
          loading={chatMutation.isPending}
          onClick={handleChat}
        >
          {isOwner ? '내 상품' : '채팅 시작'}
        </Button>
      </div>
    </article>
  );
}

function statusClass(status: string): string {
  return status.toLowerCase().replace(/_/g, '-');
}
