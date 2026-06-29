import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Flag,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
  type NotificationPage,
} from '../api/notifications';
import { toFriendlyError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import {
  formatRelativeTime,
  notificationTitle,
  notificationTypeLabel,
} from '../lib/format';
import { getNotificationTargetPath } from '../lib/navigation';
import { Button } from '../ui/Button';
import { NotificationSkeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const queryKey = ['notifications', { unreadOnly }];

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => listNotifications({ limit: 30, unreadOnly }),
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPage>(queryKey);

      queryClient.setQueryData<NotificationPage>(queryKey, (current) => {
        if (!current) {
          return current;
        }

        if (unreadOnly) {
          return {
            ...current,
            items: current.items.filter((item) => item.id !== notificationId),
            total: Math.max(0, current.total - 1),
          };
        }

        return {
          ...current,
          items: current.items.map((item) =>
            item.id === notificationId ? { ...item, isRead: true } : item,
          ),
        };
      });

      return { previous };
    },
    onError: (error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      showToast(toFriendlyError(error).message, 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsQuery.data?.items ?? [];

  const openNotification = (notification: AppNotification, targetPath: string | null) => {
    if (!notification.isRead) {
      readMutation.mutate(notification.id);
    }

    if (!targetPath) {
      showToast('관련 항목을 열 수 없습니다.', 'info');
      return;
    }

    navigate(targetPath);
  };

  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">알림</p>
          <h1 id="notifications-title">내 알림</h1>
        </div>
        <div className="segmented-control">
          <button
            className={!unreadOnly ? 'is-selected' : ''}
            onClick={() => setSearchParams({}, { replace: true })}
            type="button"
          >
            전체
          </button>
          <button
            className={unreadOnly ? 'is-selected' : ''}
            onClick={() => setSearchParams({ unreadOnly: 'true' }, { replace: true })}
            type="button"
          >
            안 읽음
          </button>
        </div>
      </header>

      {notificationsQuery.isLoading ? <NotificationSkeleton /> : null}

      {notificationsQuery.isError ? (
        <ErrorState
          description={toFriendlyError(notificationsQuery.error).message}
          onAction={() => void notificationsQuery.refetch()}
          title="알림을 불러오지 못했습니다"
        />
      ) : null}

      {!notificationsQuery.isLoading &&
      !notificationsQuery.isError &&
      notifications.length === 0 ? (
        <EmptyState
          description={unreadOnly ? '새로 읽을 알림이 없습니다.' : '거래와 채팅 소식이 이곳에 쌓입니다.'}
          title={unreadOnly ? '모두 확인했습니다' : '아직 알림이 없습니다'}
        />
      ) : null}

      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.map((notification) => {
            const targetPath = getNotificationTargetPath(notification.target, { isAdmin });
            const NotificationIcon = getNotificationIcon(notification.type);

            return (
              <article
                className={`notification-row notification-row--clickable ${notification.isRead ? 'is-read' : ''}`}
                key={notification.id}
                onClick={() => openNotification(notification, targetPath)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }

                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }

                  event.preventDefault();
                  openNotification(notification, targetPath);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="notification-row__icon" aria-hidden="true">
                  <NotificationIcon size={18} />
                </div>
                <div className="notification-row__body">
                  <div className="notification-row__meta">
                    <span>{notificationTypeLabel(notification.type)}</span>
                    <time>{formatRelativeTime(notification.createdAt)}</time>
                  </div>
                  <h2>{notificationTitle(notification.type, notification.title)}</h2>
                  <p>{notification.body || notification.message}</p>
                </div>
                <div className="notification-row__actions">
                  {!notification.isRead ? (
                    <Button
                      loading={
                        readMutation.isPending &&
                        readMutation.variables === notification.id
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        readMutation.mutate(notification.id);
                      }}
                      variant="quiet"
                    >
                      읽음
                    </Button>
                  ) : null}
                  {targetPath ? (
                    <button
                      className="row-link-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openNotification(notification, targetPath);
                      }}
                      type="button"
                    >
                      <ChevronRight size={18} />
                      <span className="sr-only">관련 항목 열기</span>
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function getNotificationIcon(type: string) {
  if (type === 'CHAT') return MessageCircle;
  if (type === 'TRANSACTION' || type === 'TX') return CreditCard;
  if (type === 'REPORT') return Flag;
  if (type === 'ADMIN_REPORT') return ShieldAlert;
  return Bell;
}
