import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface UserPayload {
  id?: string;
  shop_id?: string;
}

/**
 * Filtre d'exception global pour capturer et logger toutes les erreurs
 * Convertit les erreurs Prisma en réponses HTTP appropriées
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: UserPayload }>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erreur interne du serveur';
    let details: string | undefined = undefined;

    // Erreurs HTTP NestJS
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        const respMessage = resp.message as string | string[] | undefined;
        message = respMessage ?? exception.message;
        details = resp.error as string | undefined;
      }
    }
    // Erreurs Prisma
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
      details = prismaError.details;
    }
    // Erreurs Prisma de validation
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Erreur de validation des données';
      // Log le message complet pour debug
      this.logger.error(`Prisma Validation Error: ${exception.message}`);
    }
    // Autres erreurs
    else if (exception instanceof Error) {
      message = exception.message;
      // Logger le stack trace complet pour debug
      this.logger.error(`Unhandled Error: ${exception.message}`, exception.stack);
    }

    // Logger l'erreur avec contexte
    const logContext = {
      path: request.url,
      method: request.method,
      status,
      message,
      body: this.sanitizeBody(request.body),
      userId: request.user?.id,
      shopId: request.user?.shop_id,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${String(status)}`,
        JSON.stringify(logContext)
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${String(status)}: ${String(message)}`
      );
    }

    // Réponse au client
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error: details ?? this.getErrorName(status),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Convertit les erreurs Prisma en messages utilisateur
   */
  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    details?: string;
  } {
    switch (error.code) {
      case 'P2002': {
        // Violation de contrainte unique
        const target = error.meta?.target as string[] | undefined;
        const fields = target?.join(', ') ?? '';
        return {
          status: HttpStatus.CONFLICT,
          message: `Une entrée avec ${fields || 'ces valeurs'} existe déjà`,
          details: `Contrainte unique violée: ${fields}`,
        };
      }
      case 'P2003': {
        // Violation de clé étrangère
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Référence à un enregistrement inexistant',
          details: 'Clé étrangère invalide',
        };
      }
      case 'P2025': {
        // Enregistrement non trouvé
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Enregistrement non trouvé',
        };
      }
      default: {
        this.logger.error(
          `Unhandled Prisma Error [${error.code}]: ${error.message}`,
          JSON.stringify({ code: error.code, meta: error.meta, clientVersion: error.clientVersion })
        );
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Erreur de base de données (${error.code})`,
          details: error.message,
        };
      }
    }
  }

  /**
   * Retourne le nom de l'erreur HTTP
   */
  private getErrorName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    };
    return names[status] ?? 'Error';
  }

  /**
   * Sanitize le body pour le logging (retirer les mots de passe, etc.)
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitiveFields = ['password', 'pin', 'token', 'secret', 'key'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
