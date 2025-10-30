import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const secret = process.env.JWT_SECRET;
    
    // Валидация JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    
    this.logger.log('✅ JWT Strategy initialized with secure secret');
  }

  async validate(payload: any) {
    // Логирование для аудита
    this.logger.debug(`Token validated for user: ${payload.sub}, role: ${payload.role}`);
    
    return {
      userId: payload.sub,
      login: payload.login,
      role: payload.role,
    };
  }
}





















