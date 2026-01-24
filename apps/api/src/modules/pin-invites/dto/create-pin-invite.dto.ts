import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreatePinInviteDto {
  @IsString()
  invited_name: string;

  @IsString()
  @IsOptional()
  invited_phone?: string;

  @IsEnum(['OWNER', 'MANAGER', 'CASHIER', 'SUPERADMIN', 'ADMIN', 'EMPLOYEE'])
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'SUPERADMIN' | 'ADMIN' | 'EMPLOYEE';

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
