import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreatePinInviteDto {
  @IsString()
  invited_name: string;

  @IsString()
  @IsOptional()
  invited_phone?: string;

  @IsEnum(['BOSS', 'MANAGER', 'EMPLOYEE', 'SUPERADMIN'])
  role: 'BOSS' | 'MANAGER' | 'EMPLOYEE' | 'SUPERADMIN';

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
