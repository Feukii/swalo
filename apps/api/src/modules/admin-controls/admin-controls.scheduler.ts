import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tâche planifiée de détection des licences expirées.
 *
 * IMPORTANT : cette tâche est en LECTURE SEULE (log-only). Elle ne bloque
 * aucune entreprise et n'effectue aucune mutation. Le blocage automatique
 * de clients payants depuis un cron est volontairement hors périmètre.
 */
@Injectable()
export class AdminControlsScheduler {
  private readonly logger = new Logger(AdminControlsScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Retourne la liste des entreprises dont la licence est expirée
   * (même prédicat que `licenses.expired` des stats système).
   * Méthode publique pour faciliter les tests unitaires.
   */
  async checkExpiredLicenses(): Promise<
    { id: string; name: string; licensed_until: Date | null }[]
  > {
    const now = new Date();
    return this.prisma.enterprise.findMany({
      where: {
        deleted: false,
        is_blocked: false,
        licensed_until: { not: null, lt: now },
      },
      select: { id: true, name: true, licensed_until: true },
    });
  }

  @Cron('0 6 * * *', { name: 'daily-license-expiry-check' })
  async handleDailyLicenseExpiryCheck(): Promise<void> {
    const expired = await this.checkExpiredLicenses();

    if (expired.length === 0) {
      this.logger.log('Vérification des licences : aucune licence expirée.');
      return;
    }

    const names = expired.map(e => e.name).join(', ');
    const count = String(expired.length);
    this.logger.warn(
      `Vérification des licences : ${count} licence(s) expirée(s) (aucun blocage automatique) : ${names}`
    );
  }
}
