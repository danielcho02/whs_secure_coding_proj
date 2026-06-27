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

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(this.toErrorResponse(exception, status));
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  }

  private toErrorResponse(exception: HttpException, status: number): ErrorResponse {
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
        message,
      },
    };
  }

  private normalizeMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return typeof message === 'string' ? message : 'Request failed';
  }
}
