import { Controller, Get, Post, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * GET /api/invoices
   * Lister les factures de la boutique
   */
  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findAll(
    @CurrentUser() user: any,
    @Query('customer_id') customerId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    return this.invoicesService.findAll(user.shopId, {
      customer_id: customerId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /**
   * GET /api/invoices/:id
   * Recuperer une facture par ID
   */
  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.findOne(user.shopId, id);
  }

  /**
   * GET /api/invoices/:id/pdf
   * Telecharger le PDF d'une facture
   */
  @Get(':id/pdf')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  async getPdf(
    @CurrentUser() user: any,
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

  /**
   * POST /api/sales/:saleId/invoice
   * Generer une facture depuis une vente
   */
  @Post('from-sale/:saleId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  createFromSale(@CurrentUser() user: any, @Param('saleId') saleId: string) {
    return this.invoicesService.createFromSale(user.shopId, saleId);
  }

  /**
   * POST /api/invoices/:id/regenerate-pdf
   * Re-generer le PDF d'une facture existante
   */
  @Post(':id/regenerate-pdf')
  @Roles(Role.OWNER, Role.MANAGER)
  regeneratePdf(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.regeneratePdf(user.shopId, id);
  }
}
