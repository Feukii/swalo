import { Controller, Post, Body, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ImportService, ImportPreviewResult } from './import.service';
import { ImportPreviewDto } from './dto/import-preview.dto';

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * POST /api/import/catalog/preview
   * Aperçu de l'import avec validation
   */
  @Post('catalog/preview')
  @Roles(Role.BOSS, Role.MANAGER)
  async previewCatalog(
    @Req() req: any,
    @Body() dto: ImportPreviewDto
  ): Promise<ImportPreviewResult> {
    return this.importService.previewCatalogImport(
      req.user.shopId,
      dto.file_content,
      dto.file_name
    );
  }

  /**
   * POST /api/import/catalog/confirm
   * Confirmer et exécuter l'import
   */
  @Post('catalog/confirm')
  @Roles(Role.BOSS, Role.MANAGER)
  async confirmCatalog(@Req() req: any, @Body() dto: ImportPreviewDto) {
    return this.importService.confirmCatalogImport(
      req.user.shopId,
      dto.file_content,
      dto.file_name
    );
  }
}
