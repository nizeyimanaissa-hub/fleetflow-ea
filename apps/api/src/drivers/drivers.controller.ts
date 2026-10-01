import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyFilterQueryDto } from '../common/validation/query.dto.js';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { DriversService } from './drivers.service.js';
import { CreateDriverDto } from './dto/create-driver.dto.js';
import { UpdateDriverDto } from './dto/update-driver.dto.js';

@ApiTags('drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Get()
  findAll(@Query() query: CompanyFilterQueryDto) {
    return this.driversService.findAll(query.companyId);
  }

  @Get(':id')
  findOne(@UuidParam('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  update(@UuidParam('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  remove(@UuidParam('id') id: string) {
    return this.driversService.remove(id);
  }
}
