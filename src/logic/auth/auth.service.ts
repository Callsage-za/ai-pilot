import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from 'src/entities/user.entity';
import { Organization } from 'src/entities/organization.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['organization'],
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const payload = { 
      email: user.email, 
      sub: user.id, 
      organizationId: user.organizationId,
      role: user.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: user.organization,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Find or create organization
    let organization = await this.organizationRepository.findOne({
      where: { name: registerDto.organizationName },
    });
    

    if (!organization) {
      organization = await this.organizationRepository.save({
        name: registerDto.organizationName,
        description: registerDto.organizationDescription,
        domain: registerDto.organizationDomain,
      });
      
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Create user
    const user = await this.userRepository.save({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      role: registerDto.role || 'user',
      organizationId: organization.id,
    });

    const { password, ...result } = user;
    return {
      user: result,
      organization,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...result } = user;
    return result;
  }
}
