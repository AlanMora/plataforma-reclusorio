import { Body, Controller, Get, Injectable, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { PaginationQueryDto, paginate } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { Branch, Institution, OperationalUser } from './organization.entities';

class CreateInstitutionDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(OperationalUser) private readonly operationalUsers: Repository<OperationalUser>,
  ) {}

  createInstitution(dto: CreateInstitutionDto) {
    return this.institutions.save(this.institutions.create(dto));
  }

  async listInstitutions(query: PaginationQueryDto) {
    const [items, total] = await this.institutions.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(items, total, query);
  }
}

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organization/institutions')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.listInstitutions(query);
  }

  @Post()
  @RequirePermissions('organization:write')
  create(@Body() dto: CreateInstitutionDto) {
    return this.service.createInstitution(dto);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Institution, Branch, OperationalUser])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
