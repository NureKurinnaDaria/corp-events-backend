import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // якщо на роуті ролі не вказані — значить доступ тільки по JWT (взагалі відкритий)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: Role };

    if (!user?.role) throw new ForbiddenException('Role is missing in token');

    const allowed = requiredRoles.includes(user.role);
    if (!allowed) throw new ForbiddenException('Access denied (role)');

    return true;
  }
}
