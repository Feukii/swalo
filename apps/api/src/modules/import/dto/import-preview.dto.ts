import { IsString, IsOptional } from 'class-validator';

export class ImportPreviewDto {
  @IsString()
  file_content: string; // Base64 encoded file content

  @IsString()
  file_name: string;

  @IsOptional()
  @IsString()
  file_type?: string; // 'csv' | 'xlsx'
}
