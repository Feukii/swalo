import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceFromSaleDto, SearchInvoiceDto } from './dto/create-invoice.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@Controller('invoices')
@RequireModule('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: SearchInvoiceDto) {
    return this.invoicesService.findAll(user.shopId, query);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.findOne(user.shopId, id);
  }

  @Post('from-sale/:saleId')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  createFromSale(
    @CurrentUser() user: any,
    @Param('saleId') saleId: string,
    @Body() dto: CreateInvoiceFromSaleDto
  ) {
    return this.invoicesService.createFromSale(user.shopId, saleId, dto.notes);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.cancel(user.shopId, id);
  }
}
