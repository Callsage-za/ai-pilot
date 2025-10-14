import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['admin', 'user', 'manager'])
  role?: string;

  @IsString()
  organizationName: string;

  @IsOptional()
  @IsString()
  organizationDescription?: string;

  @IsOptional()
  @IsString()
  organizationDomain?: string;
}
