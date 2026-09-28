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
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  findAll(@Query() query: CompanyFilterQueryDto) {
    return this.vehiclesService.findAll(query.companyId);
  }

  @Get(':id')
  findOne(@UuidParam('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  update(@UuidParam('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  remove(@UuidParam('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
