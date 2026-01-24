import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Récupérer le rôle de l'utilisateur pour cette boutique
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        user_id: payload.sub,
        shop_id: payload.shopId,
        deleted: false,
      },
    });

    if (!userRole) {
      throw new UnauthorizedException('User role not found');
    }

    return {
      userId: payload.sub,
      shopId: payload.shopId,
      role: userRole.role,
    };
  }
}
