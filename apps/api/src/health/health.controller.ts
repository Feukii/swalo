import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness : ultra-léger, SANS accès base de données.
   * C'est le healthCheckPath de Render (render.yaml) : un hoquet de la DB ne
   * doit jamais faire croire à Render que l'instance est morte (sinon redémarrage).
   */
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness : vérifie ET réchauffe la base Neon (serverless, se met en veille
   * après ~5 min d'inactivité). C'est l'endpoint à pinger depuis le moniteur
   * externe (UptimeRobot / cron-job.org) pour garder API + DB chaudes ensemble.
   */
  @Public()
  @Get('ready')
  async ready() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        db_latency_ms: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch {
      // On ne jette pas : le ping doit aboutir (200) pour réveiller l'instance
      // même si la DB met un instant à se réveiller. L'état réel est dans le corps.
      return {
        status: 'degraded',
        database: 'down',
        db_latency_ms: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  }
}
