import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('PackagingTypes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      })
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/packaging-types (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/api/packaging-types').expect(401);
    });
  });

  describe('/api/packaging-types (POST)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/packaging-types')
        .send({ name: 'Test', symbol: 'T' })
        .expect(401);
    });
  });
});
