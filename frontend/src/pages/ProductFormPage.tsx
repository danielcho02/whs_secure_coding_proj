import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createProduct,
  getProduct,
  updateProduct,
  uploadProductImages,
  type CreateProductPayload,
  type Product,
} from '../api/products';
import { toFriendlyError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { formatPrice } from '../lib/format';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { ImageFallback } from '../ui/ImageFallback';
import { DetailSkeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

const CATEGORIES = [
  '디지털',
  '생활',
  '스포츠',
  '캠핑',
  '게임/취미',
  '의류',
  '가구',
  '기타',
];
const PRICE_MAX = 100_000_000;
const PRICE_ERROR_MESSAGE = '가격은 0원 이상 1억원 이하 숫자로 입력해주세요.';
const FORM_VALIDATION_ERROR = 'FORM_VALIDATION';
const IMAGE_UPLOAD_FAILED_ERROR = 'IMAGE_UPLOAD_FAILED';
const PRODUCT_ALREADY_CREATED_ERROR = 'PRODUCT_ALREADY_CREATED';

interface ProductFormState {
  title: string;
  category: string;
  price: string;
  region: string;
  description: string;
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>;

const EMPTY_FORM: ProductFormState = {
  title: '',
  category: '',
  price: '',
  region: '',
  description: '',
};

export function ProductFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [
    createdProductAfterUploadFailure,
    setCreatedProductAfterUploadFailure,
  ] = useState<Product | null>(null);

  const productQuery = useQuery({
    enabled: mode === 'edit' && Boolean(productId),
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId ?? ''),
  });

  const product = productQuery.data;
  const isOwner =
    mode === 'create' || Boolean(product && product.seller.id === user?.id);
  const validationErrors = useMemo(() => validateProductForm(form), [form]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const priceError = errors.price;

  useEffect(() => {
    if (!product || mode !== 'edit') {
      return;
    }

    setForm({
      title: product.title,
      category: product.category,
      price: String(product.price),
      region: product.region ?? '',
      description: product.description,
    });
  }, [mode, product]);

  useEffect(() => {
    document.body.classList.add('has-sticky-action');
    return () => {
      document.body.classList.remove('has-sticky-action');
    };
  }, []);

  const previews = useMemo(
    () => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [imageFiles],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateProductForm(form);
      setErrors(validation);
      setUploadError(null);

      if (Object.keys(validation).length > 0) {
        throw new Error(FORM_VALIDATION_ERROR);
      }

      if (mode === 'create' && createdProductAfterUploadFailure) {
        throw new Error(PRODUCT_ALREADY_CREATED_ERROR);
      }

      const payload = toPayload(form);
      const savedProduct =
        mode === 'create'
          ? await createProduct(payload)
          : await updateProduct(productId ?? '', payload);

      if (imageFiles.length > 0) {
        try {
          await uploadProductImages(savedProduct.id, imageFiles);
        } catch (error) {
          setUploadError(toFriendlyError(error).message);

          if (mode === 'create') {
            setCreatedProductAfterUploadFailure(savedProduct);
            throw new Error(IMAGE_UPLOAD_FAILED_ERROR);
          }

          throw error;
        }
      }

      return savedProduct;
    },
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({
        queryKey: ['product', savedProduct.id],
      });
      showToast(
        mode === 'create' ? '판매글을 등록했습니다.' : '판매글을 수정했습니다.',
        'success',
      );
      navigate(`/products/${savedProduct.id}`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === FORM_VALIDATION_ERROR) {
        showToast('입력값을 확인해주세요.', 'error');
        return;
      }

      if (
        error instanceof Error &&
        error.message === IMAGE_UPLOAD_FAILED_ERROR
      ) {
        void queryClient.invalidateQueries({ queryKey: ['products'] });
        showToast('상품은 등록됐지만 사진 업로드에 실패했습니다.', 'error');
        return;
      }

      if (
        error instanceof Error &&
        error.message === PRODUCT_ALREADY_CREATED_ERROR
      ) {
        showToast(
          '이미 등록된 상품입니다. 사진만 다시 업로드해주세요.',
          'info',
        );
        return;
      }

      showToast(toFriendlyError(error).message, 'error');
    },
    onSettled: () => {
      submittingRef.current = false;
      setIsSubmitting(false);
    },
  });

  const retryImageMutation = useMutation({
    mutationFn: async () => {
      if (!createdProductAfterUploadFailure || imageFiles.length === 0) {
        throw new Error('IMAGE_RETRY_UNAVAILABLE');
      }

      setUploadError(null);
      await uploadProductImages(
        createdProductAfterUploadFailure.id,
        imageFiles,
      );
      return createdProductAfterUploadFailure;
    },
    onSuccess: async (createdProduct) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({
        queryKey: ['product', createdProduct.id],
      });
      showToast('사진 업로드를 완료했습니다.', 'success');
      navigate(`/products/${createdProduct.id}`, { replace: true });
    },
    onError: (error) => {
      if (
        error instanceof Error &&
        error.message === 'IMAGE_RETRY_UNAVAILABLE'
      ) {
        showToast('다시 업로드할 사진을 선택해주세요.', 'error');
        return;
      }

      setUploadError(toFriendlyError(error).message);
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const isSaving = isSubmitting || saveMutation.isPending;
  const isBusy = isSaving || retryImageMutation.isPending;
  const hasCreatedProductAfterUploadFailure = Boolean(
    createdProductAfterUploadFailure,
  );

  const handleChange = (key: keyof ProductFormState, value: string) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setErrors((current) => ({
      ...current,
      [key]: validateProductForm(nextForm)[key],
    }));
  };

  const handlePriceChange = (value: string) => {
    handleChange('price', normalizePriceInput(value));
  };

  const handleImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setImageFiles(files.slice(0, 8));
    setUploadError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      submittingRef.current ||
      saveMutation.isPending ||
      hasCreatedProductAfterUploadFailure
    ) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    saveMutation.mutate();
  };

  if (mode === 'edit' && productQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (mode === 'edit' && (productQuery.isError || !product)) {
    return (
      <ErrorState
        description={toFriendlyError(productQuery.error).message}
        onAction={() => void productQuery.refetch()}
        title="판매글을 불러오지 못했습니다"
      />
    );
  }

  if (!isOwner) {
    return (
      <EmptyState
        description="판매자 본인만 이 판매글을 수정할 수 있습니다."
        onAction={() => navigate(`/products/${productId}`)}
        actionLabel="상품으로 돌아가기"
        title="수정 권한이 없습니다"
      />
    );
  }

  return (
    <form aria-busy={isBusy} className="editor-page" onSubmit={handleSubmit}>
      <header className="editor-head">
        <IconButton label="뒤로 가기" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <div>
          <p className="section-kicker">판매글</p>
          <h1>{mode === 'create' ? '동네에 내놓을 물건' : '판매글 다듬기'}</h1>
        </div>
      </header>

      <section className="editor-section editor-section--photos">
        <div className="editor-section__title">
          <Camera size={20} />
          <div>
            <h2>사진</h2>
            <p>첫 사진이 목록에서 가장 크게 보입니다.</p>
          </div>
        </div>
        <label className="photo-uploader">
          <input
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleImages}
            type="file"
          />
          <ImagePlus size={22} />
          <span>클릭해서 사진 추가</span>
        </label>

        <div className="photo-preview-grid">
          {previews.length > 0
            ? previews.map((preview, index) => (
                <div className="photo-preview" key={preview.url}>
                  <img
                    alt={`${index + 1}번째 업로드 미리보기`}
                    src={preview.url}
                  />
                  {index === 0 ? <span>대표</span> : null}
                </div>
              ))
            : product?.images.map((image, index) => (
                <div className="photo-preview" key={image.id}>
                  <ImageFallback
                    alt={`${index + 1}번째 기존 상품 사진`}
                    src={image.url}
                    title={product.title}
                    category={product.category}
                  />
                  {index === 0 ? <span>현재 대표</span> : null}
                </div>
              ))}
        </div>
        {uploadError ? <p className="field-error">{uploadError}</p> : null}
        {createdProductAfterUploadFailure ? (
          <div className="upload-recovery" role="status">
            <div>
              <strong>상품은 등록됐고 사진 업로드만 실패했습니다.</strong>
              <p>새 상품을 만들지 않고 기존 상품에 사진만 다시 업로드합니다.</p>
            </div>
            <div className="upload-recovery__actions">
              <Button
                onClick={() =>
                  navigate(`/products/${createdProductAfterUploadFailure.id}`, {
                    replace: true,
                  })
                }
                variant="quiet"
              >
                상세로 이동
              </Button>
              <Button
                disabled={imageFiles.length === 0}
                loading={retryImageMutation.isPending}
                onClick={() => retryImageMutation.mutate()}
                variant="secondary"
              >
                이미지만 다시 업로드
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="editor-section">
        <div className="editor-section__title">
          <CheckCircle2 size={20} />
          <div>
            <h2>기본 정보</h2>
            <p>검색 결과와 상품 목록에 표시되는 정보입니다.</p>
          </div>
        </div>
        <label className="field">
          <span>제목</span>
          <input
            maxLength={100}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder="예: 출퇴근용 자전거"
            value={form.title}
          />
          {errors.title ? (
            <span className="field-error">{errors.title}</span>
          ) : null}
        </label>

        <label className="field">
          <span>카테고리</span>
          <select
            onChange={(event) => handleChange('category', event.target.value)}
            value={form.category}
          >
            <option value="">카테고리를 선택해주세요</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category ? (
            <span className="field-error">{errors.category}</span>
          ) : null}
        </label>
      </section>

      <section className="editor-section">
        <div className="editor-section__title">
          <MapPin size={20} />
          <div>
            <h2>가격과 동네</h2>
            <p>입력한 금액으로 거래가 진행됩니다.</p>
          </div>
        </div>
        <div className="editor-grid">
          <label className="field">
            <span>가격</span>
            <input
              inputMode="numeric"
              min={0}
              max={PRICE_MAX}
              onChange={(event) => handlePriceChange(event.target.value)}
              placeholder="예: 50000"
              type="text"
              value={form.price ? formatPrice(Number(form.price)) : ''}
            />
            {errors.price ? (
              <span className="field-error">{errors.price}</span>
            ) : null}
          </label>
          <label className="field">
            <span>지역</span>
            <input
              maxLength={50}
              onChange={(event) => handleChange('region', event.target.value)}
              placeholder="예: 서울 성수동"
              value={form.region}
            />
            {errors.region ? (
              <span className="field-error">{errors.region}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-section__title">
          <ShieldCheck size={20} />
          <div>
            <h2>설명</h2>
            <p>하자, 구성품, 거래 희망 장소를 솔직하게 적어주세요.</p>
          </div>
        </div>
        <label className="field">
          <span>상품 설명</span>
          <textarea
            maxLength={2000}
            onChange={(event) =>
              handleChange('description', event.target.value)
            }
            placeholder="상태와 거래 조건을 자세히 적어주세요."
            value={form.description}
          />
          {errors.description ? (
            <span className="field-error">{errors.description}</span>
          ) : null}
        </label>
        <p className="editor-policy-note">
          거래 제한 품목: 주류, 의약품, 개인정보, 위조 상품은 등록할 수
          없습니다.
        </p>
      </section>

      <footer className="editor-submit-bar">
        <div>
          <strong className={priceError ? 'is-invalid' : ''}>
            {priceError
              ? '가격 확인 필요'
              : form.price
                ? `${formatPrice(Number(form.price))}원`
                : '가격 미입력'}
          </strong>
          <span>
            {priceError ??
              (hasCreatedProductAfterUploadFailure
                ? '사진 업로드를 완료하거나 상세로 이동하세요'
                : mode === 'create'
                  ? '사진과 함께 상품이 등록됩니다'
                  : '저장 후 상세로 돌아갑니다')}
          </span>
        </div>
        <Button
          disabled={
            hasValidationErrors ||
            isSaving ||
            hasCreatedProductAfterUploadFailure
          }
          loading={isSaving}
          type="submit"
        >
          {isSaving
            ? mode === 'create'
              ? '등록 중'
              : '저장 중'
            : mode === 'create'
              ? '판매글 등록'
              : '수정 저장'}
        </Button>
      </footer>
    </form>
  );
}

function normalizePriceInput(value: string): string {
  return value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
}

function validateProductForm(form: ProductFormState): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const price = Number(form.price);

  if (form.title.trim().length < 2) {
    errors.title = '제목은 2자 이상 입력해주세요.';
  }

  if (!form.category.trim()) {
    errors.category = '카테고리를 선택해주세요.';
  }

  if (
    form.price.trim() === '' ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > PRICE_MAX
  ) {
    errors.price = PRICE_ERROR_MESSAGE;
  }

  if (form.region.trim().length < 2) {
    errors.region = '거래 지역을 2자 이상 입력해주세요.';
  }

  if (form.description.trim().length < 5) {
    errors.description = '상품 설명은 5자 이상 입력해주세요.';
  }

  return errors;
}

function toPayload(form: ProductFormState): CreateProductPayload {
  return {
    title: form.title.trim(),
    category: form.category.trim(),
    price: Number(form.price),
    region: form.region.trim(),
    description: form.description.trim(),
  };
}
