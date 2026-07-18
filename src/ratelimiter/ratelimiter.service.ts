import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from './redis.provider';
import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { join } from 'path';

const INCR_AND_EXPIRE_SCRIPT = readFileSync(
  join(__dirname, 'scripts', 'incr-and-expire.lua'),
  'utf8',
);

const TOKEN_BUCKET_SCRIPT = readFileSync(
  join(__dirname, 'scripts', 'token-bucket.lua'),
  'utf8',
);
  
@Injectable()
export class RatelimiterService implements OnModuleInit {
  private readonly logger = new Logger(RatelimiterService.name);
  private readonly defaultMaxRequests: number;
  private readonly windowSizeMs: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.defaultMaxRequests = this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 5);
    this.windowSizeMs = this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 60_000);
  }

  onModuleInit() {
    this.redis.defineCommand('incrAndExpire', {
      numberOfKeys: 1,
      lua: INCR_AND_EXPIRE_SCRIPT,
    });
    this.redis.defineCommand('tokenBucket', {
      numberOfKeys: 1,
      lua: TOKEN_BUCKET_SCRIPT,
    });
  }

  async setLimit(apiKey: string, limitPerWindow: number): Promise<void> {
    await this.redis.set(`config:${apiKey}`, limitPerWindow);
  }

  private async getMaxForKey(apiKey: string): Promise<number> {
    const configured = await this.redis.get(`config:${apiKey}`);
    return configured ? parseInt(configured, 10) : this.defaultMaxRequests;
  }

  async isAllowed(apiKey: string): Promise<boolean> {
    const countKey = `count:${apiKey}`;
    const max = await this.getMaxForKey(apiKey);

    const count = await this.redis.incrAndExpire(countKey, this.windowSizeMs);

    const allowed = count <= max;

    if(allowed){
      this.logger.log(`Request allowed for ${apiKey} (${count}/${max})`);
    }else{
      this.logger.warn(`Request REJECTED for ${apiKey} (${count}/${max})`);
    }
    return allowed;
  }

  async getRetryAfterSeconds(apiKey: string): Promise<number> {
    const countKey = `count:${apiKey}`;
    const ttlMs = await this.redis.pttl(countKey);
    return ttlMs > 0 ? Math.ceil(ttlMs/ 1000): 0;
  }

  async isAllowedTokenBucket(apiKey: string): Promise<boolean> {
   const bucketKey = `bucket:${apiKey}`;
   const capacity = await this.getMaxForKey(apiKey);
   const refillRate = capacity/(this.windowSizeMs/1000);

   const allowed = await this.redis.tokenBucket(
      bucketKey,
      capacity,
      refillRate,
      Date.now(), 
   );
   return allowed === 1;
  }

}