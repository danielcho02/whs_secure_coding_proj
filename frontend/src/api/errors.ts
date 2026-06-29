import axios from 'axios';

export interface FriendlyError {
  status?: number;
  code?: string;
  message: string;
}

interface ApiErrorBody {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
}

export function toFriendlyError(error: unknown): FriendlyError {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return {
      message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  if (!error.response) {
    return {
      message: '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    };
  }

  const status = error.response.status;
  const code = error.response.data?.error?.code;
  const serverMessage = error.response.data?.error?.message;

  if (status === 401) {
    return { status, code, message: '로그인이 필요합니다.' };
  }

  if (status === 403) {
    return { status, code, message: '이 작업을 할 권한이 없습니다.' };
  }

  if (status === 404) {
    return {
      status,
      code,
      message: '존재하지 않거나 접근할 수 없는 항목입니다.',
    };
  }

  if (status === 409) {
    return {
      status,
      code,
      message: serverMessage ?? '이미 처리되었거나 현재 상태와 맞지 않습니다.',
    };
  }

  if (status >= 500) {
    return {
      status,
      code,
      message: '서버에서 요청을 처리하지 못했습니다.',
    };
  }

  return {
    status,
    code,
    message: serverMessage ?? '요청을 처리하지 못했습니다.',
  };
}
