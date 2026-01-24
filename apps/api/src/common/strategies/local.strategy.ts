import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email_or_phone',
      passwordField: 'password',
    });
  }

  async validate(emailOrPhone: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(emailOrPhone, password);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return user;
  }
}
