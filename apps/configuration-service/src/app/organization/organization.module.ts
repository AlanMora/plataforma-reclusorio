import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { Branch, Institution, OperationalUser } from './organization.entities';

class CreateInstitutionDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateInstitutionDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class CreateBranchDto {
  @IsString() institutionId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() address?: string;
}

class UpdateBranchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
}

class CreateOperationalUserDto {
  @IsString() institutionId!: string;
  @IsString() fullName!: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() authUserId?: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(OperationalUser) private readonly operationalUsers: Repository<OperationalUser>,
  ) {}

  // --- Instituciones ---
  createInstitution(dto: CreateInstitutionDto) {
    return this.institutions.save(this.institutions.create(dto));
  }

  async listInstitutions(query: PaginationQueryDto) {
    const [items, total] = await this.institutions.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query);
  }

  async getInstitution(id: string): Promise<Institution> {
    const institution = await this.institutions.findOne({ where: { id } });
    if (!institution) throw new EntityNotFoundException('Institución', id);
    return institution;
  }

  async updateInstitution(id: string, dto: UpdateInstitutionDto): Promise<Institution> {
    const institution = await this.getInstitution(id);
    Object.assign(institution, dto);
    return this.institutions.save(institution);
  }

  async removeInstitution(id: string): Promise<void> {
    const institution = await this.getInstitution(id);
    await this.institutions.softRemove(institution);
  }

  // --- Sucursales ---
  createBranch(dto: CreateBranchDto) {
    return this.branches.save(this.branches.create(dto));
  }

  listBranches(institutionId?: string) {
    return this.branches.find({
      where: institutionId ? { institutionId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  private async getBranch(id: string): Promise<Branch> {
    const branch = await this.branches.findOne({ where: { id } });
    if (!branch) throw new EntityNotFoundException('Sucursal', id);
    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.getBranch(id);
    Object.assign(branch, dto);
    return this.branches.save(branch);
  }

  async removeBranch(id: string): Promise<void> {
    const branch = await this.getBranch(id);
    await this.branches.softRemove(branch);
  }

  // --- Usuarios operativos ---
  createOperationalUser(dto: CreateOperationalUserDto) {
    return this.operationalUsers.save(this.operationalUsers.create({ ...dto, roleIds: [] }));
  }

  listOperationalUsers(institutionId?: string) {
    return this.operationalUsers.find({
      where: institutionId ? { institutionId } : {},
      order: { createdAt: 'DESC' },
    });
  }
}

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  // --- Instituciones ---
  @Get('institutions')
  @ApiOperation({ summary: 'Listar instituciones (paginado)' })
  listInstitutions(@Query() query: PaginationQueryDto) {
    return this.service.listInstitutions(query);
  }

  @Get('institutions/:id')
  @ApiOperation({ summary: 'Obtener una institución por id' })
  getInstitution(@Param('id') id: string) {
    return this.service.getInstitution(id);
  }

  @Post('institutions')
  @RequirePermissions('organization:write')
  @ApiOperation({ summary: 'Crear una institución' })
  createInstitution(@Body() dto: CreateInstitutionDto) {
    return this.service.createInstitution(dto);
  }

  @Patch('institutions/:id')
  @RequirePermissions('organization:write')
  @ApiOperation({ summary: 'Actualizar una institución' })
  updateInstitution(@Param('id') id: string, @Body() dto: UpdateInstitutionDto) {
    return this.service.updateInstitution(id, dto);
  }

  @Delete('institutions/:id')
  @RequirePermissions('organization:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar (borrado lógico) una institución' })
  removeInstitution(@Param('id') id: string) {
    return this.service.removeInstitution(id);
  }

  // --- Sucursales ---
  @Get('branches')
  @ApiOperation({ summary: 'Listar sucursales (opcionalmente por institución)' })
  listBranches(@Query('institutionId') institutionId?: string) {
    return this.service.listBranches(institutionId);
  }

  @Post('branches')
  @RequirePermissions('organization:write')
  @ApiOperation({ summary: 'Crear una sucursal' })
  createBranch(@Body() dto: CreateBranchDto) {
    return this.service.createBranch(dto);
  }

  @Patch('branches/:id')
  @RequirePermissions('organization:write')
  @ApiOperation({ summary: 'Actualizar una sucursal' })
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.service.updateBranch(id, dto);
  }

  @Delete('branches/:id')
  @RequirePermissions('organization:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar (borrado lógico) una sucursal' })
  removeBranch(@Param('id') id: string) {
    return this.service.removeBranch(id);
  }

  // --- Usuarios operativos ---
  @Get('operational-users')
  @ApiOperation({ summary: 'Listar usuarios operativos (opcionalmente por institución)' })
  listOperationalUsers(@Query('institutionId') institutionId?: string) {
    return this.service.listOperationalUsers(institutionId);
  }

  @Post('operational-users')
  @RequirePermissions('organization:write')
  @ApiOperation({ summary: 'Crear un usuario operativo del negocio' })
  createOperationalUser(@Body() dto: CreateOperationalUserDto) {
    return this.service.createOperationalUser(dto);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Institution, Branch, OperationalUser])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
