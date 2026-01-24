import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Map old roles to new roles for backward compatibility
    const roleMapping: Record<string, Role> = {
      [Role.OWNER]: Role.ADMIN,
      [Role.MANAGER]: Role.ADMIN,
      [Role.CASHIER]: Role.EMPLOYEE,
    };

    const userRole = roleMapping[user.role] || user.role;

    return requiredRoles.some((role: Role) => {
      // Map required roles as well
      const mappedRole = roleMapping[role] || role;
      return userRole === mappedRole || userRole === Role.SUPERADMIN;
    });
  }
}
