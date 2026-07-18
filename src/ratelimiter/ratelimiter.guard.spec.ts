import { RatelimiterGuard } from './ratelimiter.guard';

describe('RatelimiterGuard', () => {
  it('should be defined', () => {
    expect(new RatelimiterGuard()).toBeDefined();
  });
});
