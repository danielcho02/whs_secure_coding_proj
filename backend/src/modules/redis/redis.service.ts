import {
  Injectable,
  Inject,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../../config/configuration';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get('redis.url', { infer: true });
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  async storeRefreshSession(
    userId: string,
    jti: string,
    ttlSeconds: number,
  ): Promise<void> {
    const client = this.getClient();
    const jtiKey = this.refreshJtiKey(userId, jti);
    const sessionsKey = this.refreshSessionsKey(userId);

    await client
      .multi()
      .set(jtiKey, '1', 'EX', ttlSeconds)
      .sadd(sessionsKey, jti)
      .expire(sessionsKey, ttlSeconds)
      .exec();
  }

  async hasRefreshSession(userId: string, jti: string): Promise<boolean> {
    const result = await this.getClient().exists(this.refreshJtiKey(userId, jti));
    return result === 1;
  }

  async removeRefreshSession(userId: string, jti: string): Promise<void> {
    const client = this.getClient();
    await client
      .multi()
      .del(this.refreshJtiKey(userId, jti))
      .srem(this.refreshSessionsKey(userId), jti)
      .exec();
  }

  async removeAllRefreshSessions(userId: string): Promise<void> {
    const client = this.getClient();
    const sessionsKey = this.refreshSessionsKey(userId);
    const sessionJtis = await client.smembers(sessionsKey);
    const jtiKeys = sessionJtis.map((jti) => this.refreshJtiKey(userId, jti));

    if (jtiKeys.length > 0) {
      await client.del(...jtiKeys);
    }

    await client.del(sessionsKey);
  }

  async incrementLoginFailure(email: string, ttlSeconds: number): Promise<number> {
    const client = this.getClient();
    const key = this.loginFailureKey(email);
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }

    return count;
  }

  async clearLoginFailures(email: string): Promise<void> {
    await this.getClient().del(this.loginFailureKey(email));
  }

  private getClient(): Redis {
    if (!this.client) {
      throw new ServiceUnavailableException('Redis is not available');
    }

    return this.client;
  }

  private refreshJtiKey(userId: string, jti: string): string {
    return `auth:refresh:user:${userId}:jti:${jti}`;
  }

  private refreshSessionsKey(userId: string): string {
    return `auth:refresh:user:${userId}:sessions`;
  }

  private loginFailureKey(email: string): string {
    return `auth:login-fail:${email}`;
  }
}
