import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ Database disconnected');
  }

  /**
   * Nettoie la base de données (utile pour les tests)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(key => {
      if (typeof key === 'string') {
        return !key.startsWith('_');
      }
      return false;
    });

    const self = this as Record<string, unknown>;

    const deletions = models
      .map(modelKey => self[modelKey as string])
      .filter(
        (model): model is { deleteMany: () => Promise<unknown> } =>
          model !== null &&
          typeof model === 'object' &&
          'deleteMany' in model &&
          typeof (model as { deleteMany: unknown }).deleteMany === 'function'
      )
      .map(model => model.deleteMany());

    return Promise.all(deletions);
  }
}
