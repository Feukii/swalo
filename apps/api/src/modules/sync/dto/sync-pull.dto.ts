import { IsString, IsOptional, IsObject } from 'class-validator';

export class SyncPullDto {
  @IsString()
  device_id: string;

  @IsOptional()
  @IsString()
  last_sync_at?: string;

  @IsOptional()
  @IsObject()
  entity_versions?: Record<string, number>;
}
