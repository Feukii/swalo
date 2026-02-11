import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  create(@CurrentUser() user: any, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(user.userId, dto);
  }

  @Get()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE, Role.SUPERADMIN)
  findAll(@CurrentUser() user: any, @Query('enterprise_id') enterpriseId?: string) {
    if (enterpriseId) {
      return this.transfersService.findAllByEnterprise(enterpriseId);
    }
    return this.transfersService.findAllByShop(user.shopId);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE, Role.SUPERADMIN)
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Put(':id/confirm')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  confirm(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transfersService.confirm(id, user.userId);
  }

  @Put(':id/ship')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  ship(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transfersService.ship(id, user.userId);
  }

  @Put(':id/receive')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  receive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transfersService.receive(id, user.userId);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transfersService.cancel(id, user.userId);
  }
}
