import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, ShieldAlert } from 'lucide-react';
import { createBlock } from '../api/blocks';
import { toFriendlyError } from '../api/errors';
import { createReport, type ReportTargetType } from '../api/reports';
import { Button } from './Button';
import { Modal } from './Modal';
import { useToast } from './useToast';

const REPORT_REASONS = [
  '사기 또는 결제 유도',
  '금지 품목 또는 부적절한 상품',
  '욕설/괴롭힘',
  '스팸 또는 반복 메시지',
  '기타 안전 문제',
];

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  confirmLabel = '확인',
  danger = false,
  description,
  loading = false,
  onClose,
  onConfirm,
  open,
  title,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onClose} open={open} title={title}>
      <div className="modal-copy">
        <AlertTriangle size={22} />
        <p>{description}</p>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose} variant="quiet">
          취소
        </Button>
        <Button
          loading={loading}
          onClick={onConfirm}
          variant={danger ? 'danger' : 'primary'}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

interface ReportModalProps {
  open: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  onClose: () => void;
}

export function ReportModal({
  onClose,
  open,
  targetId,
  targetLabel,
  targetType,
}: ReportModalProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setReason(REPORT_REASONS[0]);
      setDescription('');
    }
  }, [open]);

  const reportMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      showToast('신고가 접수되었습니다.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reportMutation.mutate({
      targetId,
      targetType,
      reason,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal onClose={onClose} open={open} title="신고하기">
      <form className="safety-form" onSubmit={handleSubmit}>
        <div className="safety-form__notice">
          <ShieldAlert size={20} />
          <p>
            {targetLabel}에 대한 신고입니다. 허위 신고는 처리 과정에서 반려될 수
            있습니다.
          </p>
        </div>

        <fieldset className="choice-list">
          <legend>신고 사유</legend>
          {REPORT_REASONS.map((item) => (
            <label key={item}>
              <input
                checked={reason === item}
                onChange={() => setReason(item)}
                type="radio"
              />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span>상세 설명</span>
          <textarea
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="상황을 구체적으로 적어주시면 검토에 도움이 됩니다."
            value={description}
          />
        </label>

        <div className="modal-actions">
          <Button onClick={onClose} variant="quiet">
            취소
          </Button>
          <Button loading={reportMutation.isPending} type="submit">
            신고 접수
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface BlockModalProps {
  open: boolean;
  userId: string;
  nickname: string;
  onClose: () => void;
}

export function BlockModal({ nickname, onClose, open, userId }: BlockModalProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const blockMutation = useMutation({
    mutationFn: createBlock,
    onSuccess: () => {
      showToast('사용자를 차단했습니다.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      onClose();
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  return (
    <Modal onClose={onClose} open={open} title="사용자 차단">
      <div className="modal-copy modal-copy--danger">
        <Ban size={22} />
        <p>
          {nickname}님을 차단하면 채팅과 거래 과정에서 불필요한 상호작용을 줄일
          수 있습니다. 기존 서버 권한과 기록은 그대로 유지됩니다.
        </p>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose} variant="quiet">
          취소
        </Button>
        <Button
          loading={blockMutation.isPending}
          onClick={() => blockMutation.mutate(userId)}
          variant="danger"
        >
          차단
        </Button>
      </div>
    </Modal>
  );
}
