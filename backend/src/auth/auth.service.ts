import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateAdmin(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (admin && admin.password === dto.password) {
      // In a real app, we would use bcrypt and return a JWT
      // For this hackathon, we'll return the admin profile as a simple "token"
      const { password, ...result } = admin;
      return result;
    }
    
    throw new UnauthorizedException('Invalid credentials');
  }

  // Seed default admin if none exists
  async onModuleInit() {
    const adminCount = await this.prisma.admin.count();
    if (adminCount === 0) {
      await this.prisma.admin.create({
        data: {
          email: 'admin@downtime.ai',
          password: 'password123',
          name: 'Super Admin',
          role: 'SUPERADMIN',
        },
      });
      console.log('✅ Default Admin seeded: admin@downtime.ai / password123');
    }
  }
}
