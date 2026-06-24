import { Controller, Get, Post, Put, Param, Query, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceFromSaleDto, SearchInvoiceDto } from './dto/create-invoice.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { RequireModule } from '../../common/decorators/require-module.decorator';

interface AuthUser {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('invoices')
@RequireModule('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findAll(@CurrentUser() user: AuthUser, @Query() query: SearchInvoiceDto) {
    return this.invoicesService.findAll(user.shopId, query);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.findOne(user.shopId, id);
  }

  /**
   * GET /api/invoices/:id/pdf
   * Telecharger le PDF d'une facture
   */
  @Get(':id/pdf')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  async getPdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res() res: Response
  ) {
    const { pdf_data, number } = await this.invoicesService.getPdf(user.shopId, id);

    if (format === 'base64') {
      res.json({ pdf_data, number });
      return;
    }

    const buffer = Buffer.from(pdf_data, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${number}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post('from-sale/:saleId')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  createFromSale(
    @CurrentUser() user: AuthUser,
    @Param('saleId') saleId: string,
    @Body() dto: CreateInvoiceFromSaleDto
  ) {
    return this.invoicesService.createFromSale(user.shopId, saleId, dto.notes);
  }

  /**
   * POST /api/invoices/:id/regenerate-pdf
   * Re-generer le PDF d'une facture existante
   */
  @Post(':id/regenerate-pdf')
  @Roles(Role.BOSS, Role.MANAGER)
  regeneratePdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.regeneratePdf(user.shopId, id);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.cancel(user.shopId, id);
  }
}
