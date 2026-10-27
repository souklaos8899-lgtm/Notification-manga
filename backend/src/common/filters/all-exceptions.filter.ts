import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const resBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (
      resBody &&
      typeof resBody === 'object' &&
      'error' in resBody &&
      Object.keys(resBody).length === 1
    ) {
      response.status(status).json(resBody);
      return;
    }

    if (status === 404) {
      response.status(404).json({ error: 'Endpoint not found' });
      return;
    }

    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      message =
        typeof resp === 'string'
          ? resp
          : (resp as any).message || (resp as any).error || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({ error: message });
  }
}

