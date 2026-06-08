import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * E2E Test: Product Hierarchy Management Workflow
 *
 * This test validates:
 * 1. Create products with hierarchy (family, article_type, brand, reference)
 * 2. Batch rename hierarchy levels
 * 3. Cascade filtering
 * 4. Verify all products updated correctly
 */
describe('Product Hierarchy Workflow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let shopId: string;
  let userId: string;
  let enterpriseId: string;
  let productIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create test user, enterprise, shop, role and a real JWT
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        password_hash: 'hashed_password',
        display_name: 'Test User',
      },
    });
    userId = user.id;

    const enterprise = await prisma.enterprise.create({
      data: {
        code: `TE${Math.floor(Math.random() * 1000000)}`,
        name: 'Test Enterprise',
        owner_id: userId,
        license_tier: 'ENTERPRISE',
      },
    });
    enterpriseId = enterprise.id;

    const shop = await prisma.shop.create({
      data: {
        id: `test-shop-${Date.now()}`,
        name: 'Test Shop',
        code: `TS${Math.floor(Math.random() * 1000000)}`,
        address: 'Test Address',
        owner_id: userId,
        enterprise_id: enterpriseId,
        enabled_modules: [
          'auth',
          'products',
          'customers',
          'sales',
          'cash',
          'inventory',
          'suppliers',
          'receivables',
          'debts',
          'payments',
          'reports',
        ],
      },
    });
    shopId = shop.id;

    await prisma.userRole.create({
      data: {
        user_id: userId,
        shop_id: shopId,
        role: 'BOSS',
      },
    });

    // Real JWT matching jwt.strategy ({ sub, shopId } signed with JWT_SECRET)
    const config = app.get(ConfigService);
    const token = new JwtService().sign(
      { sub: userId, shopId },
      { secret: config.get<string>('JWT_SECRET'), expiresIn: '24h' }
    );
    authToken = `Bearer ${token}`;
  });

  afterAll(async () => {
    // Cleanup (FK-safe order)
    await prisma.product.deleteMany({ where: { shop_id: shopId } });
    await prisma.userRole.deleteMany({ where: { shop_id: shopId } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.enterprise.deleteMany({ where: { id: enterpriseId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    await app.close();
  });

  describe('Complete Hierarchy Management Workflow', () => {
    it('should create products with full hierarchy', async () => {
      // Create multiple products in GLASSES family
      const products = [
        {
          sku: 'GLASS-SAM-A10-001',
          name: 'Samsung A10 Glass 3D',
          family: 'GLASSES',
          article_type: 'Glass 3D',
          brand: 'Samsung',
          reference: 'A10',
          cost_price: 1000,
          sell_price: 1500,
        },
        {
          sku: 'GLASS-SAM-A20-001',
          name: 'Samsung A20 Glass 3D',
          family: 'GLASSES',
          article_type: 'Glass 3D',
          brand: 'Samsung',
          reference: 'A20',
          cost_price: 1200,
          sell_price: 1800,
        },
        {
          sku: 'GLASS-TEC-S1-001',
          name: 'Tecno Spark 1 Glass 3D',
          family: 'GLASSES',
          article_type: 'Glass 3D',
          brand: 'Tecno',
          reference: 'Spark 1',
          cost_price: 900,
          sell_price: 1400,
        },
        {
          sku: 'GLASS-SAM-A10-2D',
          name: 'Samsung A10 Glass 2D',
          family: 'GLASSES',
          article_type: 'Glass 2D',
          brand: 'Samsung',
          reference: 'A10',
          cost_price: 800,
          sell_price: 1200,
        },
      ];

      for (const productData of products) {
        const response = await request(app.getHttpServer())
          .post('/products')
          .set('Authorization', authToken)
          .send(productData)
          .expect(201);

        productIds.push(response.body.id);
        expect(response.body.family).toBe(productData.family);
        expect(response.body.brand).toBe(productData.brand);
      }

      expect(productIds).toHaveLength(4);
    });

    it('should batch rename family for all products', async () => {
      // Rename GLASSES → SCREEN_PROTECTORS
      const batchUpdateResponse = await request(app.getHttpServer())
        .post('/products/batch-update-hierarchy')
        .set('Authorization', authToken)
        .send({
          level: 'family',
          old_value: 'GLASSES',
          new_value: 'SCREEN_PROTECTORS',
        })
        .expect(201);

      expect(batchUpdateResponse.body.count).toBe(4);
      expect(batchUpdateResponse.body.message).toContain('4 produit(s) mis à jour');

      // Verify all products updated
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      products.forEach(product => {
        expect(product.family).toBe('SCREEN_PROTECTORS');
      });
    });

    it('should batch rename article_type with family filter', async () => {
      // Rename Glass 3D → Glass 3D Premium (only within SCREEN_PROTECTORS family)
      const batchUpdateResponse = await request(app.getHttpServer())
        .post('/products/batch-update-hierarchy')
        .set('Authorization', authToken)
        .send({
          level: 'article_type',
          old_value: 'Glass 3D',
          new_value: 'Glass 3D Premium',
          family: 'SCREEN_PROTECTORS',
        })
        .expect(201);

      expect(batchUpdateResponse.body.count).toBe(3); // Only 3 products have Glass 3D

      // Verify only Glass 3D products updated
      const updatedProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          article_type: 'Glass 3D Premium',
        },
      });

      expect(updatedProducts).toHaveLength(3);

      // Verify Glass 2D product unchanged
      const glass2DProduct = await prisma.product.findFirst({
        where: {
          id: { in: productIds },
          article_type: 'Glass 2D',
        },
      });

      expect(glass2DProduct).toBeDefined();
      expect(glass2DProduct!.article_type).toBe('Glass 2D');
    });

    it('should batch rename brand with family and article_type filters', async () => {
      // Rename Samsung → Samsung Electronics (only for SCREEN_PROTECTORS + Glass 3D Premium)
      const batchUpdateResponse = await request(app.getHttpServer())
        .post('/products/batch-update-hierarchy')
        .set('Authorization', authToken)
        .send({
          level: 'brand',
          old_value: 'Samsung',
          new_value: 'Samsung Electronics',
          family: 'SCREEN_PROTECTORS',
          article_type: 'Glass 3D Premium',
        })
        .expect(201);

      expect(batchUpdateResponse.body.count).toBe(2); // 2 Samsung products with Glass 3D Premium

      // Verify correct products updated
      const samsungPremium = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          brand: 'Samsung Electronics',
          article_type: 'Glass 3D Premium',
        },
      });

      expect(samsungPremium).toHaveLength(2);

      // Verify Samsung Glass 2D product unchanged
      const samsung2D = await prisma.product.findFirst({
        where: {
          id: { in: productIds },
          brand: 'Samsung',
          article_type: 'Glass 2D',
        },
      });

      expect(samsung2D).toBeDefined();
      expect(samsung2D!.brand).toBe('Samsung');
    });

    it('should provide cascade filters', async () => {
      // Get all filters (no cascade)
      const allFiltersResponse = await request(app.getHttpServer())
        .get('/products/filters')
        .set('Authorization', authToken)
        .expect(200);

      expect(allFiltersResponse.body.families).toContain('SCREEN_PROTECTORS');
      expect(allFiltersResponse.body.brands).toContain('Samsung Electronics');
      expect(allFiltersResponse.body.brands).toContain('Samsung');
      expect(allFiltersResponse.body.brands).toContain('Tecno');

      // Get filters with family cascade
      const familyFilterResponse = await request(app.getHttpServer())
        .get('/products/filters?family=SCREEN_PROTECTORS')
        .set('Authorization', authToken)
        .expect(200);

      expect(familyFilterResponse.body.families).toEqual(['SCREEN_PROTECTORS']);
      expect(familyFilterResponse.body.brands.sort()).toEqual(
        ['Samsung', 'Samsung Electronics', 'Tecno'].sort()
      );

      // Get filters with family + article_type cascade
      const fullCascadeResponse = await request(app.getHttpServer())
        .get('/products/filters?family=SCREEN_PROTECTORS&article_type=Glass 3D Premium')
        .set('Authorization', authToken)
        .expect(200);

      // The article_type filter narrows the next level (brands), not the
      // article_types list itself — so all types in the family are returned.
      expect(fullCascadeResponse.body.article_types.sort()).toEqual(
        ['Glass 2D', 'Glass 3D Premium'].sort()
      );
      expect(fullCascadeResponse.body.brands.sort()).toEqual(
        ['Samsung Electronics', 'Tecno'].sort()
      );
    });

    it('should filter products by hierarchy', async () => {
      // Filter by family only
      const familyFilterResponse = await request(app.getHttpServer())
        .get('/products?family=SCREEN_PROTECTORS')
        .set('Authorization', authToken)
        .expect(200);

      expect(familyFilterResponse.body.length).toBe(4);

      // Filter by family + brand
      const brandFilterResponse = await request(app.getHttpServer())
        .get('/products?family=SCREEN_PROTECTORS&brand=Samsung Electronics')
        .set('Authorization', authToken)
        .expect(200);

      expect(brandFilterResponse.body.length).toBe(2);

      // Filter by all levels
      const fullFilterResponse = await request(app.getHttpServer())
        .get(
          '/products?family=SCREEN_PROTECTORS&brand=Samsung Electronics&article_type=Glass 3D Premium'
        )
        .set('Authorization', authToken)
        .expect(200);

      expect(fullFilterResponse.body.length).toBe(2);
    });

    it('should increment version on batch update', async () => {
      // Get current versions
      const beforeProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, version: true },
      });

      const versionsBefore = new Map(beforeProducts.map(p => [p.id, p.version]));

      // Perform batch update
      await request(app.getHttpServer())
        .post('/products/batch-update-hierarchy')
        .set('Authorization', authToken)
        .send({
          level: 'reference',
          old_value: 'A10',
          new_value: 'A10E',
          family: 'SCREEN_PROTECTORS',
        })
        .expect(201);

      // Verify versions incremented
      const afterProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, version: true, reference: true },
      });

      afterProducts.forEach(product => {
        if (product.reference === 'A10E') {
          // Products that were updated should have version incremented
          const beforeVersion = versionsBefore.get(product.id) || 0;
          expect(product.version).toBeGreaterThan(beforeVersion);
        }
      });
    });
  });
});
