import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
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

const CATEGORIES = ['디지털', '생활', '스포츠', '캠핑', '게임', '의류', '가구', '기타'];
const PRICE_MAX = 100_000_000;
const PRICE_ERROR_MESSAGE = '가격은 0원 이상 1억원 이하 숫자로 입력해주세요.';

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
  category: '디지털',
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
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const productQuery = useQuery({
    enabled: mode === 'edit' && Boolean(productId),
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId ?? ''),
  });

  const product = productQuery.data;
  const isOwner = mode === 'create' || Boolean(product && product.seller.id === user?.id);
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
        throw new Error('FORM_VALIDATION');
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
          throw error;
        }
      }

      return savedProduct;
    },
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['product', savedProduct.id] });
      showToast(mode === 'create' ? '판매글을 등록했습니다.' : '판매글을 수정했습니다.', 'success');
      navigate(`/products/${savedProduct.id}`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'FORM_VALIDATION') {
        showToast('입력값을 확인해주세요.', 'error');
        return;
      }

      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const handleChange = (key: keyof ProductFormState, value: string) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setErrors((current) => ({ ...current, [key]: validateProductForm(nextForm)[key] }));
  };

  const handleImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setImageFiles(files.slice(0, 8));
    setUploadError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <form className="editor-page" onSubmit={handleSubmit}>
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
          <span>사진 선택</span>
        </label>

        <div className="photo-preview-grid">
          {previews.length > 0
            ? previews.map((preview, index) => (
                <div className="photo-preview" key={preview.url}>
                  <img alt={`${index + 1}번째 업로드 미리보기`} src={preview.url} />
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
      </section>

      <section className="editor-section">
        <div className="editor-section__title">
          <CheckCircle2 size={20} />
          <div>
            <h2>기본 정보</h2>
            <p>검색과 신고 검토에 그대로 쓰이는 정보입니다.</p>
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
          {errors.title ? <span className="field-error">{errors.title}</span> : null}
        </label>

        <label className="field">
          <span>카테고리</span>
          <select
            onChange={(event) => handleChange('category', event.target.value)}
            value={form.category}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category ? <span className="field-error">{errors.category}</span> : null}
        </label>
      </section>

      <section className="editor-section">
        <div className="editor-section__title">
          <MapPin size={20} />
          <div>
            <h2>가격과 동네</h2>
            <p>금액은 숫자로만 입력하고, 결제 금액은 서버가 확정합니다.</p>
          </div>
        </div>
        <div className="editor-grid">
          <label className="field">
            <span>가격</span>
            <input
              inputMode="numeric"
              min={0}
              max={PRICE_MAX}
              onChange={(event) => handleChange('price', event.target.value)}
              placeholder="0"
              type="number"
              value={form.price}
            />
            {errors.price ? <span className="field-error">{errors.price}</span> : null}
          </label>
          <label className="field">
            <span>지역</span>
            <input
              maxLength={50}
              onChange={(event) => handleChange('region', event.target.value)}
              placeholder="예: 서울 성수동"
              value={form.region}
            />
            {errors.region ? <span className="field-error">{errors.region}</span> : null}
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
            onChange={(event) => handleChange('description', event.target.value)}
            placeholder="상태와 거래 조건을 자세히 적어주세요."
            value={form.description}
          />
          {errors.description ? (
            <span className="field-error">{errors.description}</span>
          ) : null}
        </label>
      </section>

      <footer className="editor-submit-bar">
        <div>
          <strong className={priceError ? 'is-invalid' : ''}>
            {priceError ? '가격 확인 필요' : form.price ? `${formatPrice(Number(form.price))}원` : '가격 미입력'}
          </strong>
          <span>{priceError ?? (mode === 'create' ? '등록 후 사진이 업로드됩니다' : '저장 후 상세로 돌아갑니다')}</span>
        </div>
        <Button disabled={hasValidationErrors} loading={saveMutation.isPending} type="submit">
          {mode === 'create' ? '판매글 등록' : '수정 저장'}
        </Button>
      </footer>
    </form>
  );
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

  if (!Number.isSafeInteger(price) || price < 0 || price > PRICE_MAX) {
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
