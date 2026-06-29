import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const processLogger = new Logger('Process');

/**
 * Garde-fous niveau process : sur Render free tier, une seule promesse rejetée
 * non gérée (tâche de fond, scan de notifications, appel « non bloquant »…)
 * suffit à tuer tout le serveur Node (comportement par défaut depuis Node 15),
 * ce qui se traduit par « l'API tombe » jusqu'au prochain cold start.
 * On loggue et on garde le serveur en vie : la priorité ici est la disponibilité.
 */
function installProcessGuards() {
  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    processLogger.error(`Unhandled promise rejection (serveur maintenu en vie): ${message}`);
  });

  process.on('uncaughtException', (error: Error) => {
    processLogger.error(
      `Uncaught exception (serveur maintenu en vie): ${error.stack ?? error.message}`
    );
  });
}

async function bootstrap() {
  installProcessGuards();

  const app = await NestFactory.create(AppModule);

  // Arrêts/redéploiements Render propres : déclenche onModuleDestroy (déconnexion Prisma)
  // sur SIGTERM/SIGINT au lieu de couper brutalement.
  app.enableShutdownHooks();

  // Global exception filter pour logger toutes les erreurs
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS - restreindre les origines en production
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : true; // En développement, accepter toutes les origines
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global validation pipe with security settings
  // Note: whitelist: true filtre silencieusement les propriétés non définies dans le DTO
  // forbidNonWhitelisted a été retiré car il rejetait aussi les propriétés optionnelles (@IsOptional)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    })
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces

  console.log(`Swalo API is running on:`);
  console.log(`   Local:   http://localhost:${String(port)}/api`);
  console.log(`   Network: http://192.168.1.88:${String(port)}/api`);
}

void bootstrap();
