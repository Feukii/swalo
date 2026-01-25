import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter pour logger toutes les erreurs
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS
  app.enableCors({
    origin: true, // Accept all origins for development (localhost + network IPs)
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

  console.log(`SWALO API is running on:`);
  console.log(`   Local:   http://localhost:${String(port)}/api`);
  console.log(`   Network: http://192.168.1.88:${String(port)}/api`);
}

void bootstrap();
