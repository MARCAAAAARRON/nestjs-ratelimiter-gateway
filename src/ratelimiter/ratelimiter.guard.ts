import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RatelimiterService } from './ratelimiter.service';
import { RateLimitExceededException } from './rate-limit-exceeded.exception';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class RatelimiterGuard implements CanActivate {

  private readonly logger = new Logger(RatelimiterGuard.name);

  constructor(private readonly rateLimiterService: RatelimiterService,
              @InjectMetric('rate_limit_allowed_total')
              private readonly allowedCounter: Counter<string>,
              @InjectMetric('rate_limit_rejected_total')
              private readonly rejectedCounter: Counter<string>,
  ){
  }

  async canActivate(context: ExecutionContext,): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    const algorithm = (request.headers['x-algorithm'] as string) || 'fixed-window';

    if(!apiKey){
      this.logger.warn('Request blocked: missing API key');
      throw new ForbiddenException('Missing Api key');
    }

    const allowed = algorithm === 'token-bucket'
    ? await this.rateLimiterService.isAllowedTokenBucket(apiKey)
    : await this.rateLimiterService.isAllowed(apiKey);

    if(!allowed){
      const retryAfter = await this.rateLimiterService.getRetryAfterSeconds(apiKey);
      this.logger.warn(`Rate limit exceeded for ${apiKey}, retry after ${retryAfter}`);
      this.rejectedCounter.inc({apiKey, algorithm});
      throw new RateLimitExceededException(retryAfter);
    }

    this.allowedCounter.inc({apiKey, algorithm});
  return true;
}
}