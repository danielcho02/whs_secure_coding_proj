import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Ban,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  Send,
  WifiOff,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getChat,
  listChats,
  listMessages,
  markChatRead,
  sendMessage,
  type Chat,
  type ChatListItem,
  type ChatMessage,
} from '../api/chats';
import { getAccessToken, WS_BASE_URL } from '../api/client';
import { toFriendlyError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { formatPrice, formatRelativeTime, productStatusLabel } from '../lib/format';
import { IconButton } from '../ui/IconButton';
import { ImageFallback } from '../ui/ImageFallback';
import { BlockModal, ReportModal } from '../ui/SafetyActions';
import { ChatSkeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/useToast';

type ChatSocket = Socket;

interface PendingMessage {
  localId: string;
  content: string;
  sentAt: number;
  status: 'sending' | 'failed';
}

interface SocketMessageAck {
  event: 'message';
  data: ChatMessage;
}

interface ChatMessageCache {
  items: ChatMessage[];
  page: number;
  limit: number;
  total: number;
}

const MESSAGE_RECONCILE_WINDOW_MS = 15_000;

export function ChatsPage() {
  const navigate = useNavigate();
  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: () => listChats({ limit: 50 }),
  });
  const chats = chatsQuery.data?.items ?? [];

  return (
    <section className="chat-page chat-page--list" aria-labelledby="chats-title">
      <header className="page-head">
        <div>
          <p className="section-kicker">채팅</p>
          <h1 id="chats-title">거래 대화</h1>
        </div>
      </header>

      {chatsQuery.isLoading ? <ChatSkeleton /> : null}
      {chatsQuery.isError ? (
        <ErrorState
          description={toFriendlyError(chatsQuery.error).message}
          onAction={() => void chatsQuery.refetch()}
          title="채팅 목록을 불러오지 못했습니다"
        />
      ) : null}
      {!chatsQuery.isLoading && !chatsQuery.isError && chats.length === 0 ? (
        <EmptyState
          description="상품 상세에서 채팅을 시작하면 이곳에 대화가 생깁니다."
          onAction={() => navigate('/')}
          actionLabel="상품 둘러보기"
          title="아직 열린 채팅이 없습니다"
        />
      ) : null}
      {chats.length > 0 ? <ChatList chats={chats} /> : null}
    </section>
  );
}

export function ChatRoomPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [socketState, setSocketState] = useState<'idle' | 'connected' | 'blocked'>('idle');
  const [content, setContent] = useState('');
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [reportedMessage, setReportedMessage] = useState<ChatMessage | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const chatQuery = useQuery({
    enabled: Boolean(chatId),
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId ?? ''),
  });
  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: () => listChats({ limit: 50 }),
  });
  const messagesQuery = useQuery({
    enabled: Boolean(chatId),
    queryKey: ['chatMessages', chatId],
    queryFn: () => listMessages(chatId ?? '', { limit: 100 }),
  });

  const reconcileServerMessage = useCallback(
    (message: ChatMessage, localId?: string) => {
      setPendingMessages((current) => removeReconciledPending(current, message, user?.id, localId));
      queryClient.setQueryData<ChatMessageCache>(['chatMessages', chatId], (current) => {
        if (!current || current.items.some((item) => item.id === message.id)) {
          return current;
        }

        return { ...current, items: [...current.items, message], total: current.total + 1 };
      });
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    [chatId, queryClient, user?.id],
  );

  useEffect(() => {
    if (!chatId || !user || user.status !== 'ACTIVE') {
      setSocketState(user && user.status !== 'ACTIVE' ? 'blocked' : 'idle');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setSocketState('idle');
      return;
    }

    const nextSocket = io(`${WS_BASE_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    });

    nextSocket.on('connect', () => {
      setSocketState('connected');
      nextSocket.emit('join', { chatId });
      nextSocket.emit('read', { chatId });
    });
    nextSocket.on('disconnect', () => {
      setSocketState('idle');
    });
    nextSocket.on('connect_error', () => {
      setSocketState('blocked');
    });
    nextSocket.on('message', (message: ChatMessage) => {
      reconcileServerMessage(message);
    });
    nextSocket.on('read', () => {
      void queryClient.invalidateQueries({ queryKey: ['chatMessages', chatId] });
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [chatId, queryClient, reconcileServerMessage, user]);

  useEffect(() => {
    if (!chatId) {
      return;
    }

    markChatRead(chatId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
      })
      .catch(() => undefined);
  }, [chatId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messagesQuery.data?.items.length, pendingMessages.length]);

  const chat = chatQuery.data;
  const counterpart = useMemo(() => getCounterpart(chat, user?.id), [chat, user?.id]);
  const messages = messagesQuery.data?.items ?? [];

  const sendMutation = useMutation({
    mutationFn: async ({ text }: { text: string; localId: string; sentAt: number }) => {
      if (!chatId) {
        throw new Error('CHAT_ID_REQUIRED');
      }

      if (socket?.connected) {
        const ack = await socket.timeout(5_000).emitWithAck('message', {
          chatId,
          content: text,
        }) as SocketMessageAck;
        return ack.data;
      }

      return sendMessage(chatId, { content: text });
    },
    onSuccess: (message, variables) => {
      reconcileServerMessage(message, variables.localId);
    },
    onError: (error, variables) => {
      setPendingMessages((current) =>
        current.map((item) =>
          item.localId === variables.localId ? { ...item, status: 'failed' } : item,
        ),
      );
      showToast(toFriendlyError(error).message, 'error');
    },
  });

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = content.trim();
    if (!text) {
      return;
    }

    const localId = crypto.randomUUID();
    const sentAt = Date.now();
    setPendingMessages((current) => [...current, { localId, content: text, sentAt, status: 'sending' }]);
    setContent('');
    sendMutation.mutate({ text, localId, sentAt });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const retryPending = (pending: PendingMessage) => {
    const sentAt = Date.now();
    setPendingMessages((current) =>
      current.map((item) =>
        item.localId === pending.localId ? { ...item, sentAt, status: 'sending' } : item,
      ),
    );
    sendMutation.mutate({ text: pending.content, localId: pending.localId, sentAt });
  };

  if (chatQuery.isLoading || messagesQuery.isLoading) {
    return <ChatSkeleton />;
  }

  if (chatQuery.isError || messagesQuery.isError || !chat) {
    return (
      <ErrorState
        description={toFriendlyError(chatQuery.error ?? messagesQuery.error).message}
        onAction={() => {
          void chatQuery.refetch();
          void messagesQuery.refetch();
        }}
        title="채팅방을 불러오지 못했습니다"
      />
    );
  }

  return (
    <section className="chat-room-page">
      <aside className="chat-split-list" aria-label="채팅 목록">
        <ChatList chats={chatsQuery.data?.items ?? []} selectedId={chat.id} />
      </aside>

      <div className="chat-room">
        <header className="chat-room__top">
          <IconButton label="채팅 목록" onClick={() => navigate('/chats')}>
            <ArrowLeft size={20} />
          </IconButton>
          <div className="chat-room__person">
            <strong>{counterpart?.nickname ?? '상대방'}</strong>
            <span>
              {socketState === 'connected' ? '실시간 연결됨' : '메시지는 서버로 안전하게 전송됩니다'}
            </span>
          </div>
          <IconButton label="상대방 차단" onClick={() => setBlockOpen(true)}>
            <Ban size={18} />
          </IconButton>
        </header>

        <Link className="chat-product-bar" to={`/products/${chat.product.id}`}>
          <ImageFallback
            alt={`${chat.product.title} 상품 사진`}
            src={chat.product.thumbnailUrl}
            title={chat.product.title}
          />
          <span>
            <strong>{chat.product.title}</strong>
            <small>
              {formatPrice(chat.product.price)}원 · {productStatusLabel(chat.product.status)}
            </small>
          </span>
        </Link>

        {socketState === 'blocked' ? (
          <div className="socket-warning">
            <WifiOff size={17} />
            <span>실시간 연결이 제한되었습니다. 계정 상태나 세션을 확인해주세요.</span>
          </div>
        ) : null}

        <div className="message-list" aria-live="polite">
          {messages.length === 0 && pendingMessages.length === 0 ? (
            <div className="message-empty">
              <MessageCircle size={28} />
              <p>첫 메시지를 보내 거래 조건을 확인해보세요.</p>
            </div>
          ) : null}
          {messages.map((message) => {
            const mine = message.sender.id === user?.id;
            return (
              <article
                className={`message-bubble ${mine ? 'message-bubble--mine' : ''}`}
                key={message.id}
              >
                {!mine ? <span className="message-bubble__sender">{message.sender.nickname}</span> : null}
                <p>{message.content}</p>
                {message.imageUrl ? <ImageIcon size={14} /> : null}
                <button
                  className="message-bubble__menu"
                  onClick={() => setReportedMessage(message)}
                  type="button"
                >
                  <MoreVertical size={14} />
                  <span className="sr-only">메시지 신고</span>
                </button>
                <time>{formatRelativeTime(message.createdAt)}</time>
              </article>
            );
          })}
          {pendingMessages.map((pending) => (
            <article className="message-bubble message-bubble--mine is-pending" key={pending.localId}>
              <p>{pending.content}</p>
              {pending.status === 'failed' ? (
                <button onClick={() => retryPending(pending)} type="button">
                  재전송
                </button>
              ) : (
                <time>전송 중</time>
              )}
            </article>
          ))}
          <div ref={endRef} />
        </div>

        <form className="message-composer" onSubmit={submitMessage}>
          <input
            maxLength={1000}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="메시지 보내기"
            value={content}
          />
          <IconButton disabled={!content.trim()} label="전송" type="submit">
            <Send size={18} />
          </IconButton>
        </form>
      </div>

      {reportedMessage ? (
        <ReportModal
          onClose={() => setReportedMessage(null)}
          open={Boolean(reportedMessage)}
          targetId={reportedMessage.id}
          targetLabel="채팅 메시지"
          targetType="CHAT"
        />
      ) : null}
      {counterpart ? (
        <BlockModal
          nickname={counterpart.nickname}
          onClose={() => setBlockOpen(false)}
          open={blockOpen}
          userId={counterpart.id}
        />
      ) : null}
    </section>
  );
}

function ChatList({
  chats,
  selectedId,
}: {
  chats: ChatListItem[];
  selectedId?: string;
}) {
  return (
    <div className="chat-list">
      {chats.map((chat) => (
        <Link
          className={`chat-row ${selectedId === chat.id ? 'is-selected' : ''}`}
          key={chat.id}
          to={`/chats/${chat.id}`}
        >
          <ImageFallback
            alt={`${chat.product.title} 상품 사진`}
            src={chat.product.thumbnailUrl}
            title={chat.product.title}
          />
          <span className="chat-row__body">
            <span>
              <strong>{chat.counterpart.nickname}</strong>
              <time>
                {chat.lastMessage ? formatRelativeTime(chat.lastMessage.createdAt) : '새 채팅'}
              </time>
            </span>
            <small>{chat.product.title}</small>
            <em>{chat.lastMessage?.content ?? '아직 메시지가 없습니다'}</em>
          </span>
          {chat.unreadCount > 0 ? <i>{Math.min(chat.unreadCount, 99)}</i> : null}
        </Link>
      ))}
    </div>
  );
}

function getCounterpart(chat: Chat | undefined, userId: string | undefined) {
  if (!chat || !userId) {
    return null;
  }

  return chat.buyer.id === userId ? chat.seller : chat.buyer;
}

function removeReconciledPending(
  pendingMessages: PendingMessage[],
  message: ChatMessage,
  currentUserId: string | undefined,
  localId?: string,
): PendingMessage[] {
  if (localId) {
    return pendingMessages.filter((pending) => pending.localId !== localId);
  }

  const matchedIndex = pendingMessages.findIndex((pending) =>
    isMatchingPendingMessage(pending, message, currentUserId),
  );

  if (matchedIndex < 0) {
    return pendingMessages;
  }

  return pendingMessages.filter((_, index) => index !== matchedIndex);
}

function isMatchingPendingMessage(
  pending: PendingMessage,
  message: ChatMessage,
  currentUserId: string | undefined,
): boolean {
  if (!currentUserId || message.sender.id !== currentUserId || pending.status !== 'sending') {
    return false;
  }

  const serverTime = new Date(message.createdAt).getTime();
  if (!Number.isFinite(serverTime)) {
    return false;
  }

  return (
    pending.content === message.content &&
    Math.abs(serverTime - pending.sentAt) <= MESSAGE_RECONCILE_WINDOW_MS
  );
}
