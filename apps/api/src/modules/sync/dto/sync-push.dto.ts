import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class SyncMutationDto {
  @IsIn(['insert', 'upsert', 'update', 'delete'])
  op: 'insert' | 'upsert' | 'update' | 'delete';

  @IsString()
  id: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  client_op_id: string;

  @IsString()
  device_id: string;

  @IsString()
  timestamp: string;
}

export class SyncPushDto {
  @IsString()
  device_id: string;

  @IsObject()
  changes: Record<string, SyncMutationDto[]>;

  @IsOptional()
  @IsString()
  base_cursor?: string;
}
