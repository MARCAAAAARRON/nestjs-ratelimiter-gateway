import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RatelimiterService } from './ratelimiter.service';
import { REDIS_CLIENT } from './redis.provider';

describe('RatelimiterService', () => {
  let service: RatelimiterService;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incrAndExpire: jest.fn(),
      pttl: jest.fn(),
      defineCommand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatelimiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => defaultValue),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RatelimiterService>(RatelimiterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});