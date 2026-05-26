import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

export interface JwtRequest extends Request {
  user: JwtPayload;
}
