import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { DomainValidationError, NotFoundError } from '../../domain/errors/domain.errors';

@Catch(DomainValidationError, NotFoundError)
export class DomainErrorFilter implements ExceptionFilter {
    catch(e: Error, host: ArgumentsHost) {
        const res = host.switchToHttp().getResponse();
        const status = e instanceof NotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        res.status(status).json({ statusCode: status, message: e.message });
    }
}