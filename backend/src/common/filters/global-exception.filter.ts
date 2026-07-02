import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface HttpResponse {
  status: (statusCode: number) => {
    send: (body: unknown) => void;
  };
}

interface HttpRequest {
  url?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const request = host.switchToHttp().getRequest<HttpRequest>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logServerException(exception, status, request.url);
      response.status(status).send(this.toErrorResponse(exception, status));
      return;
    }

    this.logServerException(
      exception,
      HttpStatus.INTERNAL_SERVER_ERROR,
      request.url,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  }

  private toErrorResponse(
    exception: HttpException,
    status: number,
  ): ErrorResponse {
    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? this.normalizeMessage(exceptionResponse.message)
        : exception.message;

    return {
      success: false,
      error: {
        code: HttpStatus[status] ?? 'HTTP_ERROR',
        message: status >= 500 ? 'Internal server error' : message,
      },
    };
  }

  private logServerException(
    exception: unknown,
    status: number,
    path: string | undefined,
  ): void {
    if (status < 500 || process.env.NODE_ENV === 'production') {
      return;
    }

    const name = exception instanceof Error ? exception.name : typeof exception;
    const message =
      exception instanceof Error ? exception.message : 'Non-error exception';

    console.error(
      `[exception] name=${name} message=${message} path=${path ?? 'unknown'}`,
    );
  }

  private normalizeMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return typeof message === 'string' ? message : 'Request failed';
  }
}
