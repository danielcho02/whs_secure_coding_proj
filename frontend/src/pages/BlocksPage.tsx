import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ShieldOff } from 'lucide-react';
import { deleteBlock, listBlocks } from '../api/blocks';
import { toFriendlyError } from '../api/errors';
import { trustSummary } from '../lib/format';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function BlocksPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const blocksQuery = useQuery({
    queryKey: ['blocks'],
    queryFn: () => listBlocks({ limit: 50 }),
  });

  const unblockMutation = useMutation({
    mutationFn: deleteBlock,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['blocks'] });
      showToast('차단을 해제했습니다.', 'success');
    },
    onError: (error) => {
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const blocks = blocksQuery.data?.items ?? [];

  return (
    <section className="blocks-page" aria-labelledby="blocks-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">차단 관리</p>
          <h1 id="blocks-title">대화를 제한한 사용자</h1>
        </div>
      </header>

      {blocksQuery.isError ? (
        <ErrorState
          description={toFriendlyError(blocksQuery.error).message}
          onAction={() => void blocksQuery.refetch()}
          title="차단 목록을 불러오지 못했습니다"
        />
      ) : null}
      {!blocksQuery.isLoading && !blocksQuery.isError && blocks.length === 0 ? (
        <EmptyState
          description="불편한 사용자를 차단하면 이곳에서 다시 해제할 수 있습니다."
          title="차단한 사용자가 없습니다"
        />
      ) : null}
      {blocks.length > 0 ? (
        <div className="user-action-list">
          {blocks.map((block) => (
            <article className="user-action-row" key={block.id}>
              <div className="user-avatar">
                {block.blocked.avatarUrl ? (
                  <img alt="" src={block.blocked.avatarUrl} />
                ) : (
                  block.blocked.nickname.slice(0, 1)
                )}
              </div>
              <div>
                <strong>{block.blocked.nickname}</strong>
                <span>
                  {trustSummary(block.blocked.completedTx, block.blocked.trustScore)}
                </span>
              </div>
              <Button
                icon={<ShieldOff size={17} />}
                loading={
                  unblockMutation.isPending &&
                  unblockMutation.variables === block.blockedId
                }
                onClick={() => unblockMutation.mutate(block.blockedId)}
                variant="secondary"
              >
                해제
              </Button>
            </article>
          ))}
        </div>
      ) : blocksQuery.isLoading ? (
        <div className="user-action-list">
          <article className="user-action-row">
            <div className="skeleton skeleton--dot" />
            <div className="skeleton skeleton--line skeleton--wide" />
            <Ban size={18} />
          </article>
        </div>
      ) : null}
    </section>
  );
}
