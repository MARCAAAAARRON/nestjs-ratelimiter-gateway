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

  describe('isAllowed', () => {
    it('should allow a request when count is within the default limit', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incrAndExpire.mockResolvedValue(1);

      const result = await service.isAllowed('some-key');

      expect(result).toBe(true);
    });

    it('should reject a request when count exceeds the default limit', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incrAndExpire.mockResolvedValue(6);

      const result = await service.isAllowed('some-key');

      expect(result).toBe(false);
    });

    it('should use a configured per-key limit instead of the default', async () => {
      mockRedis.get.mockResolvedValue('20');
      mockRedis.incrAndExpire.mockResolvedValue(10);

      const result = await service.isAllowed('vip-key');

      expect(result).toBe(true);
    });
  });

  describe('getRetryAfterSeconds', () => {
    it('should convert Redis PTTL from milliseconds to whole seconds', async () => {
      mockRedis.pttl.mockResolvedValue(45000);

      const result = await service.getRetryAfterSeconds('some-key');

      expect(result).toBe(45);
    });

    it('should return 0 when the key has no active TTL', async () => {
      mockRedis.pttl.mockResolvedValue(-2);

      const result = await service.getRetryAfterSeconds('some-key');

      expect(result).toBe(0);
    });
  });
});