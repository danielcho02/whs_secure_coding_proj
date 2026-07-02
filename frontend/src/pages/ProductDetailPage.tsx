import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Edit3,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { createChat } from '../api/chats';
import { toFriendlyError } from '../api/errors';
import {
  deleteProduct,
  getProduct,
  toggleFavorite,
  updateProductStatus,
  type SellerProductStatus,
} from '../api/products';
import { createTransaction } from '../api/transactions';
import { useAuth } from '../auth/useAuth';
import {
  formatPrice,
  formatRelativeTime,
  productStatusLabel,
  trustDetail,
} from '../lib/format';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { ImageFallback } from '../ui/ImageFallback';
import { BlockModal, ConfirmModal, ReportModal } from '../ui/SafetyActions';
import { DetailSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('has-sticky-action');

    return () => {
      document.body.classList.remove('has-sticky-action');
    };
  }, []);

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

  const transactionMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: (transaction) => {
      showToast('거래 요청을 보냈습니다.', 'success');
      navigate(`/transactions/${transaction.id}`);
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: SellerProductStatus) =>
      updateProductStatus(productId ?? '', nextStatus),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({
        queryKey: ['product', updated.id],
      });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('상품 상태를 변경했습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(productId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('판매글을 삭제했습니다.', 'success');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const product = productQuery.data;
  const selectedImage =
    product?.images[selectedImageIndex]?.url ?? product?.images[0]?.url ?? null;
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
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
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

  const handleTransaction = () => {
    if (!product) {
      return;
    }

    if (status !== 'authenticated') {
      showToast('거래 요청은 로그인 후 사용할 수 있습니다.', 'info');
      navigate('/login');
      return;
    }

    transactionMutation.mutate({ productId: product.id });
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
      </div>

      <section className="detail-hero" aria-label="상품 사진">
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          className="detail-hero__image"
          src={selectedImage}
          title={product.title}
        />
        <span
          className={`status-chip status-chip--${statusClass(product.status)}`}
        >
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
          <div className="seller-band__avatar">
            {product.seller.nickname.slice(0, 1)}
          </div>
          <div>
            <strong>{product.seller.nickname}</strong>
            <span title="신뢰도는 최대 5점이며 완료 거래와 후기 기반으로 표시됩니다.">
              {trustDetail(
                product.seller.completedTx,
                product.seller.trustScore,
              )}
            </span>
            <small className="seller-band__help">
              신뢰도는 최대 5점 기준입니다.
            </small>
          </div>
          <ShieldCheck size={20} />
        </section>

        {isOwner ? (
          <section className="owner-console" aria-label="판매글 관리">
            <div>
              <h2>판매글 관리</h2>
              <p>상태 변경은 서버 응답을 받은 뒤 반영됩니다.</p>
            </div>
            <div className="owner-console__actions">
              <Button
                icon={<Edit3 size={17} />}
                onClick={() => navigate(`/products/${product.id}/edit`)}
                variant="secondary"
              >
                수정
              </Button>
              {(['ON_SALE', 'RESERVED', 'SOLD'] as SellerProductStatus[]).map(
                (nextStatus) => (
                  <Button
                    disabled={product.status === nextStatus}
                    key={nextStatus}
                    loading={
                      statusMutation.isPending &&
                      statusMutation.variables === nextStatus
                    }
                    onClick={() => statusMutation.mutate(nextStatus)}
                    variant="quiet"
                  >
                    {productStatusLabel(nextStatus)}
                  </Button>
                ),
              )}
              <Button
                icon={<Trash2 size={17} />}
                onClick={() => setDeleteOpen(true)}
                variant="danger"
              >
                삭제
              </Button>
            </div>
          </section>
        ) : (
          <section className="safety-strip" aria-label="안전 도구">
            <Button
              icon={<Flag size={17} />}
              onClick={() => setReportOpen(true)}
              variant="quiet"
            >
              상품 신고
            </Button>
            <Button
              icon={<Ban size={17} />}
              onClick={() => setBlockOpen(true)}
              variant="quiet"
            >
              판매자 차단
            </Button>
          </section>
        )}

        <section
          className="detail-description"
          aria-labelledby="description-title"
        >
          <h2 id="description-title">상품 설명</h2>
          <p>{product.description}</p>
        </section>
      </section>

      <div className="sticky-action">
        <div>
          <span>{formatPrice(product.price)}원</span>
          <small>안전거래 요청 가능</small>
        </div>
        <Button
          disabled={isOwner || product.status !== 'ON_SALE'}
          icon={<MessageCircle size={18} />}
          loading={chatMutation.isPending}
          onClick={handleChat}
        >
          {isOwner ? '내 상품' : '채팅 시작'}
        </Button>
        {!isOwner ? (
          <Button
            disabled={product.status !== 'ON_SALE'}
            icon={<ShoppingBag size={18} />}
            loading={transactionMutation.isPending}
            onClick={handleTransaction}
            variant="secondary"
          >
            거래 요청
          </Button>
        ) : null}
      </div>

      <ReportModal
        onClose={() => setReportOpen(false)}
        open={reportOpen}
        targetId={product.id}
        targetLabel={product.title}
        targetType="PRODUCT"
      />
      <BlockModal
        nickname={product.seller.nickname}
        onClose={() => setBlockOpen(false)}
        open={blockOpen}
        userId={product.seller.id}
      />
      <ConfirmModal
        confirmLabel="삭제"
        danger
        description="삭제한 판매글은 목록에서 사라집니다. 서버에서 권한을 다시 확인한 뒤 처리합니다."
        loading={deleteMutation.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        open={deleteOpen}
        title="판매글을 삭제할까요?"
      />
    </article>
  );
}

function statusClass(status: string): string {
  return status.toLowerCase().replace(/_/g, '-');
}
