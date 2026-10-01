import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Company } from '../generated/prisma/client.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCompanyDto): Promise<Company> {
    return this.prisma.company.create({ data: { name: dto.name } });
  }

  findAll(): Promise<Company[]> {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<Company> {
    await this.findOne(id);
    return this.prisma.company.delete({ where: { id } });
  }
}
