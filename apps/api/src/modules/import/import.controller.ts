import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ImportService, ImportPreviewResult } from './import.service';
import { ImportPreviewDto } from './dto/import-preview.dto';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * POST /api/import/catalog/preview
   * Aperçu de l'import avec validation
   */
  @Post('catalog/preview')
  @Roles(Role.OWNER, Role.MANAGER)
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
  @Roles(Role.OWNER, Role.MANAGER)
  async confirmCatalog(@Req() req: any, @Body() dto: ImportPreviewDto) {
    return this.importService.confirmCatalogImport(
      req.user.shopId,
      dto.file_content,
      dto.file_name
    );
  }
}
