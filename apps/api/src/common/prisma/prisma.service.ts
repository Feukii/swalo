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

    return Promise.all(
      models.map(modelKey => {
        const model = (this as any)[modelKey as string];
        if (model && typeof model.deleteMany === 'function') {
          return model.deleteMany();
        }
      })
    );
  }
}
