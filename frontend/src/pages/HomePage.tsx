import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Heart, MapPin, PackagePlus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  listProducts,
  searchProducts,
  toggleFavorite,
  type Product,
  type ProductSort,
} from '../api/products';
import { toFriendlyError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatPrice, formatRelativeTime, productStatusLabel } from '../lib/format';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { ImageFallback } from '../ui/ImageFallback';
import { ProductFeedSkeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

const CATEGORY_OPTIONS = ['', '디지털', '생활', '스포츠', '캠핑', '게임'];
const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: 'latest', label: '최신순' },
  { value: 'priceAsc', label: '낮은 가격' },
  { value: 'priceDesc', label: '높은 가격' },
];

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';
  const sort = parseSort(searchParams.get('sort'));
  const page = parsePositiveInt(searchParams.get('page')) ?? 1;
  const min = parsePositiveInt(searchParams.get('min'));
  const max = parsePositiveInt(searchParams.get('max'));
  const [searchText, setSearchText] = useState(q);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchText, 280);

  const updateParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          next.delete(key);
          return;
        }

        next.set(key, String(value));
      });

      if (!('page' in updates)) {
        next.delete('page');
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  useEffect(() => {
    const nextQuery = debouncedSearch.trim();

    if (nextQuery !== q) {
      updateParams({ q: nextQuery });
    }
  }, [debouncedSearch, q, updateParams]);

  const productQuery = useQuery({
    queryKey: ['products', { category, max, min, page, q, sort }],
    queryFn: () => {
      const params = {
        category: category || undefined,
        limit: 20,
        max,
        min,
        page,
        sort,
      };

      if (q) {
        return searchProducts({ ...params, q });
      }

      return listProducts(params);
    },
    placeholderData: keepPreviousData,
  });

  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
  });

  const handleFavorite = async (productId: string) => {
    if (status !== 'authenticated') {
      showToast('찜은 로그인 후 사용할 수 있습니다.', 'info');
      navigate('/login');
      return;
    }

    const wasLiked = likedIds.has(productId);
    setLikedIds((current) => {
      const next = new Set(current);
      if (wasLiked) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });

    try {
      const result = await favoriteMutation.mutateAsync(productId);
      setLikedIds((current) => {
        const next = new Set(current);
        if (result.favorited) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch (error) {
      setLikedIds((current) => {
        const next = new Set(current);
        if (wasLiked) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return next;
      });
      showToast(toFriendlyError(error).message, 'error');
    }
  };

  const total = productQuery.data?.total ?? 0;
  const products = productQuery.data?.items ?? [];
  const hasNextPage = page * 20 < total;

  return (
    <section className="market-page" aria-labelledby="market-title">
      <div className="market-head">
        <div>
          <p className="section-kicker">우리 동네 물건</p>
          <h1 id="market-title">지금 올라온 거래</h1>
        </div>
        <div className="market-head__actions">
          {status === 'authenticated' ? (
            <Button
              icon={<PackagePlus size={17} />}
              onClick={() => navigate('/products/new')}
            >
              판매하기
            </Button>
          ) : null}
          <Button
            className="market-head__filter"
            icon={<SlidersHorizontal size={17} />}
            onClick={() => setIsFilterOpen(true)}
            variant="secondary"
          >
            필터
          </Button>
        </div>
      </div>

      <form
        className="market-search"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          updateParams({ q: searchText.trim() });
        }}
      >
        <Search size={19} />
        <input
          aria-label="상품 검색"
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="상품명, 카테고리, 동네 키워드"
          type="search"
          value={searchText}
        />
      </form>

      <div className="market-filters" aria-label="상품 필터">
        <div className="chip-row">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              className={`filter-chip ${category === option ? 'is-selected' : ''}`}
              key={option || 'all'}
              onClick={() => updateParams({ category: option })}
              type="button"
            >
              {option || '전체'}
            </button>
          ))}
        </div>

        <div className="segmented-control">
          {SORT_OPTIONS.map((option) => (
            <button
              aria-pressed={sort === option.value}
              className={sort === option.value ? 'is-selected' : ''}
              key={option.value}
              onClick={() => updateParams({ sort: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {productQuery.isFetching && !productQuery.isLoading ? (
        <div className="subtle-progress" aria-hidden="true" />
      ) : null}

      {productQuery.isLoading ? <ProductFeedSkeleton /> : null}

      {productQuery.isError ? (
        <ErrorState
          description={toFriendlyError(productQuery.error).message}
          onAction={() => void productQuery.refetch()}
          title="상품을 불러오지 못했습니다"
        />
      ) : null}

      {!productQuery.isLoading && !productQuery.isError && products.length === 0 ? (
        <EmptyState
          description="검색어와 필터를 조금 넓히면 더 많은 동네 물건을 볼 수 있습니다."
          onAction={() => updateParams({ category: '', max: '', min: '', q: '', sort: 'latest' })}
          title="조건에 맞는 상품이 없습니다"
          actionLabel="필터 초기화"
        />
      ) : null}

      {products.length > 0 ? (
        <>
          <div className="feed-list">
            {products.map((product) => (
              <ProductTile
                isFavoritePending={favoriteMutation.isPending}
                isLiked={likedIds.has(product.id)}
                key={product.id}
                onFavorite={handleFavorite}
                product={product}
              />
            ))}
          </div>

          <div className="pagination-row">
            <Button
              disabled={page <= 1}
              onClick={() => updateParams({ page: page - 1 })}
              variant="secondary"
            >
              이전
            </Button>
            <span>{page} / {Math.max(1, Math.ceil(total / 20))}</span>
            <Button
              disabled={!hasNextPage}
              onClick={() => updateParams({ page: page + 1 })}
              variant="secondary"
            >
              다음
            </Button>
          </div>
        </>
      ) : null}

      <FilterSheet
        category={category}
        max={max}
        min={min}
        onClose={() => setIsFilterOpen(false)}
        onUpdate={updateParams}
        open={isFilterOpen}
        sort={sort}
      />
    </section>
  );
}

interface ProductTileProps {
  product: Product;
  isLiked: boolean;
  isFavoritePending: boolean;
  onFavorite: (productId: string) => void;
}

function ProductTile({
  isFavoritePending,
  isLiked,
  onFavorite,
  product,
}: ProductTileProps) {
  const thumbnail = product.images[0]?.url ?? null;

  return (
    <article className="product-tile">
      <Link className="product-tile__image-link" to={`/products/${product.id}`}>
        <ImageFallback
          alt={`${product.title} 상품 사진`}
          category={product.category}
          className="product-tile__image"
          src={thumbnail}
          title={product.title}
        />
        <span className={`status-chip status-chip--${statusClass(product.status)}`}>
          {productStatusLabel(product.status)}
        </span>
      </Link>

      <div className="product-tile__content">
        <Link className="product-tile__title" to={`/products/${product.id}`}>
          {product.title}
        </Link>
        <div className="product-tile__price">{formatPrice(product.price)}원</div>
        <div className="product-tile__meta">
          <span>
            <MapPin size={14} />
            {product.region ?? '동네 미정'}
          </span>
          <span>{formatRelativeTime(product.createdAt)}</span>
        </div>
        <div className="product-tile__seller">
          <span>{product.seller.nickname}</span>
          <span>신뢰 {product.seller.trustScore}</span>
        </div>
      </div>

      <IconButton
        active={isLiked}
        className={`heart-button ${isLiked ? 'heart-button--pop' : ''}`}
        disabled={isFavoritePending}
        label="찜하기"
        onClick={(event) => {
          event.preventDefault();
          onFavorite(product.id);
        }}
      >
        <Heart fill={isLiked ? 'currentColor' : 'none'} size={19} />
      </IconButton>
    </article>
  );
}

interface FilterSheetProps {
  category: string;
  sort: ProductSort;
  min?: number;
  max?: number;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Record<string, string | number | null | undefined>) => void;
}

function FilterSheet({
  category,
  max,
  min,
  onClose,
  onUpdate,
  open,
  sort,
}: FilterSheetProps) {
  const [draftMin, setDraftMin] = useState(min?.toString() ?? '');
  const [draftMax, setDraftMax] = useState(max?.toString() ?? '');

  useEffect(() => {
    setDraftMin(min?.toString() ?? '');
    setDraftMax(max?.toString() ?? '');
  }, [max, min, open]);

  return (
    <BottomSheet onClose={onClose} open={open} title="검색 필터">
      <div className="sheet-section">
        <h3>카테고리</h3>
        <div className="chip-row chip-row--wrap">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              className={`filter-chip ${category === option ? 'is-selected' : ''}`}
              key={option || 'all-sheet'}
              onClick={() => onUpdate({ category: option })}
              type="button"
            >
              {option || '전체'}
            </button>
          ))}
        </div>
      </div>

      <div className="sheet-section">
        <h3>정렬</h3>
        <div className="segmented-control segmented-control--full">
          {SORT_OPTIONS.map((option) => (
            <button
              className={sort === option.value ? 'is-selected' : ''}
              key={option.value}
              onClick={() => onUpdate({ sort: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="sheet-section"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdate({
            max: draftMax.trim() ? Number(draftMax) : '',
            min: draftMin.trim() ? Number(draftMin) : '',
          });
          onClose();
        }}
      >
        <h3>가격대</h3>
        <div className="price-range">
          <input
            inputMode="numeric"
            min={0}
            onChange={(event) => setDraftMin(event.target.value)}
            placeholder="최소"
            type="number"
            value={draftMin}
          />
          <span />
          <input
            inputMode="numeric"
            min={0}
            onChange={(event) => setDraftMax(event.target.value)}
            placeholder="최대"
            type="number"
            value={draftMax}
          />
        </div>
        <div className="sheet-actions">
          <Button
            onClick={() => {
              onUpdate({ category: '', max: '', min: '', sort: 'latest' });
              onClose();
            }}
            variant="quiet"
          >
            초기화
          </Button>
          <Button type="submit">적용</Button>
        </div>
      </form>
    </BottomSheet>
  );
}

function parseSort(value: string | null): ProductSort {
  if (value === 'priceAsc' || value === 'priceDesc') {
    return value;
  }

  return 'latest';
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function statusClass(status: string): string {
  return status.toLowerCase().replace(/_/g, '-');
}
