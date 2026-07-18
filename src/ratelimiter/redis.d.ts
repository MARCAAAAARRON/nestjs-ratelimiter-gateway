import 'ioredis';

declare module 'ioredis'{
    interface RedisCommander<Context> {
        incrAndExpire(key: string, windowMs: number): Promise<number>;
        tokenBucket(
            key: string,
            capacity: number,
            fillRate: number,
            now: number,
        ): Promise<number>;
    }
}