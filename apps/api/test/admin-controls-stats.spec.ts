import { Test, TestingModule } from '@nestjs/testing';
import { AdminControlsService } from '../src/modules/admin-controls/admin-controls.service';
import { AdminControlsScheduler } from '../src/modules/admin-controls/admin-controls.scheduler';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('AdminControls - System Stats & License Scheduler', () => {
  let service: AdminControlsService;
  let scheduler: AdminControlsScheduler;

  const mockPrismaService = {
    user: { count: jest.fn() },
    shop: { count: jest.fn() },
    enterprise: { count: jest.fn(), findMany: jest.fn() },
    userDevice: { count: jest.fn() },
    auditLog: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminControlsService,
        AdminControlsScheduler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminControlsService>(AdminControlsService);
    scheduler = module.get<AdminControlsScheduler>(AdminControlsScheduler);

    jest.clearAllMocks();
  });

  describe('getEnhancedSystemStats', () => {
    beforeEach(() => {
      // user.count: total, active, blocked
      mockPrismaService.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // active
        .mockResolvedValueOnce(5); // blocked
      // shop.count: total, blocked
      mockPrismaService.shop.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(2); // blocked
      // enterprise.count: total, blocked, expired, expiringSoon
      mockPrismaService.enterprise.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(1) // blocked
        .mockResolvedValueOnce(3) // expired licenses
        .mockResolvedValueOnce(4); // expiring soon
      // userDevice.count: 15min, 24h, 7d
      mockPrismaService.userDevice.count
        .mockResolvedValueOnce(7) // last15min
        .mockResolvedValueOnce(15) // last24h
        .mockResolvedValueOnce(30); // last7d
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
    });

    it('returns connectedDevices recency windows', async () => {
      const stats = await service.getEnhancedSystemStats();
      expect(stats.connectedDevices).toEqual({ last15min: 7, last24h: 15, last7d: 30 });
    });

    it('returns licenses expired/expiringSoon counts', async () => {
      const stats = await service.getEnhancedSystemStats();
      expect(stats.licenses).toEqual({ expired: 3, expiringSoon: 4 });
    });

    it('keeps the existing users/shops/enterprises shape intact', async () => {
      const stats = await service.getEnhancedSystemStats();
      expect(stats.users).toEqual({ total: 100, active: 80, blocked: 5 });
      expect(stats.shops).toEqual({ total: 20, blocked: 2, active: 18 });
      expect(stats.enterprises).toEqual({ total: 10, blocked: 1, active: 9 });
      expect(stats.recentAuditLogs).toEqual([]);
    });

    it('queries active devices with last_login_at recency windows', async () => {
      await service.getEnhancedSystemStats();
      const calls = mockPrismaService.userDevice.count.mock.calls;
      expect(calls).toHaveLength(3);
      for (const [arg] of calls) {
        expect(arg.where.is_active).toBe(true);
        expect(arg.where.last_login_at.gte).toBeInstanceOf(Date);
      }
      // 15min window must be more recent than 24h, which is more recent than 7d
      const w15 = calls[0][0].where.last_login_at.gte.getTime();
      const w24 = calls[1][0].where.last_login_at.gte.getTime();
      const w7d = calls[2][0].where.last_login_at.gte.getTime();
      expect(w15).toBeGreaterThan(w24);
      expect(w24).toBeGreaterThan(w7d);
    });

    it('queries expired licenses with the documented where-clause', async () => {
      await service.getEnhancedSystemStats();
      const expiredCall = mockPrismaService.enterprise.count.mock.calls[2][0];
      expect(expiredCall.where.deleted).toBe(false);
      expect(expiredCall.where.is_blocked).toBe(false);
      expect(expiredCall.where.licensed_until.not).toBeNull();
      expect(expiredCall.where.licensed_until.lt).toBeInstanceOf(Date);

      const expiringSoonCall = mockPrismaService.enterprise.count.mock.calls[3][0];
      expect(expiringSoonCall.where.licensed_until.gte).toBeInstanceOf(Date);
      expect(expiringSoonCall.where.licensed_until.lt).toBeInstanceOf(Date);
    });
  });

  describe('AdminControlsScheduler.checkExpiredLicenses', () => {
    it('selects expired enterprises (deleted:false, is_blocked:false, licensed_until lt now)', async () => {
      const expired = [
        { id: 'ent-1', name: 'Acme', licensed_until: new Date('2020-01-01') },
        { id: 'ent-2', name: 'Globex', licensed_until: new Date('2021-06-01') },
      ];
      mockPrismaService.enterprise.findMany.mockResolvedValue(expired);

      const result = await scheduler.checkExpiredLicenses();

      expect(result).toEqual(expired);
      const call = mockPrismaService.enterprise.findMany.mock.calls[0][0];
      expect(call.where.deleted).toBe(false);
      expect(call.where.is_blocked).toBe(false);
      expect(call.where.licensed_until.not).toBeNull();
      expect(call.where.licensed_until.lt).toBeInstanceOf(Date);
      expect(call.select).toEqual({ id: true, name: true, licensed_until: true });
    });

    it('handleDailyLicenseExpiryCheck performs no mutation', async () => {
      mockPrismaService.enterprise.findMany.mockResolvedValue([]);
      await scheduler.handleDailyLicenseExpiryCheck();
      // findMany is the only DB access; no update/create/delete on enterprise
      expect(mockPrismaService.enterprise.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
