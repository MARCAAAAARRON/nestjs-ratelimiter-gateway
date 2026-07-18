import { Module } from '@nestjs/common';
import { RatelimiterController } from './ratelimiter.controller';
import { RatelimiterService } from './ratelimiter.service';
import { RatelimiterGuard } from './ratelimiter.guard';
import { redisProvider } from './redis.provider';
import { HttpModule } from '@nestjs/axios';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports:[HttpModule],
  controllers: [RatelimiterController],
  providers: [RatelimiterService, RatelimiterGuard, redisProvider,
    makeCounterProvider({name: 'rate_limit_allowed_total', help: 'Total number of allowed requests', labelNames: ['apiKey', 'algorithm']}),
    makeCounterProvider({name: 'rate_limit_rejected_total', help: 'Total number of rejected requests', labelNames: ['apiKey', 'algorithm']}),
  ],
})
export class RatelimiterModule {}
