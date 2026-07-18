import { ExceptionFilter, Catch, ArgumentsHost } from "@nestjs/common";
import type { Response } from "express";
import { RateLimitExceededException } from "./rate-limit-exceeded.exception";

@Catch(RateLimitExceededException)
export class RateLimitExceededFilter implements ExceptionFilter{
    catch(exception: RateLimitExceededException, host: ArgumentsHost){
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        response
        .status(exception.getStatus())
        .header('Retry-After', String(exception.retryAfterSeconds))
        .json({
            statusCode: exception.getStatus,
            message: exception.message,
            retryAfterSeconds: exception.retryAfterSeconds,
        });
    }
}