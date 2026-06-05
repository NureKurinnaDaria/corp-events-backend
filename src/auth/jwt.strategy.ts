import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

function extractFromCookieOrHeader(req: Request): string | null {
  if (req.cookies?.token) {
    return req.cookies.token as string;
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not set');
    }

    super({
      jwtFromRequest: extractFromCookieOrHeader,
      secretOrKey: secret,
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        position: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}
