import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceFromSaleDto, SearchInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findAll(@CurrentUser() user: any, @Query() query: SearchInvoiceDto) {
    return this.invoicesService.findAll(user.shopId, query);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.findOne(user.shopId, id);
  }

  @Post('from-sale/:saleId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  createFromSale(
    @CurrentUser() user: any,
    @Param('saleId') saleId: string,
    @Body() dto: CreateInvoiceFromSaleDto
  ) {
    return this.invoicesService.createFromSale(user.shopId, saleId, dto.notes);
  }

  @Put(':id/cancel')
  @Roles(Role.OWNER, Role.MANAGER)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.cancel(user.shopId, id);
  }
}
