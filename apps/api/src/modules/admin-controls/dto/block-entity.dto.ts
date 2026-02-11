import { IsString, IsNotEmpty } from 'class-validator';

export class BlockEntityDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
