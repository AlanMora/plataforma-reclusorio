import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { BusinessRuleException, EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { AuthenticatedUser, CurrentUser, TenantContext } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { OutboxService } from '@icms/messaging';
import { ExampleEntity } from './example.entity';

class CreateExampleDto {
  @IsString() name!: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}

class UpdateExampleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}

/**
 * Servicio de dominio de ejemplo. Muestra el patrón: validaciones + reglas de
 * negocio + persistencia + publicación de eventos de dominio.
 */
@Injectable()
export class ExampleService {
  constructor(
    @InjectRepository(ExampleEntity) private readonly repo: Repository<ExampleEntity>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Crea la entidad y publica el evento de dominio de forma **transaccional**:
   * el evento se escribe en el Outbox dentro de la MISMA transacción (§7.1).
   */
  async create(dto: CreateExampleDto, user: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.getRepository(ExampleEntity).create({
        ...dto,
        tenantId: user.tenantId,
        createdBy: user.id,
        status: 'draft',
      });
      const saved = await manager.save(entity);
      await this.outbox.enqueue(
        manager,
        'example.created',
        { id: saved.id },
        {
          tenantId: user.tenantId,
          aggregateId: saved.id,
          correlationId: TenantContext.get()?.correlationId,
        },
      );
      return saved;
    });
  }

  async activate(id: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('ExampleEntity', id);
    // Regla de negocio de ejemplo: sólo se activa desde "draft".
    if (entity.status !== 'draft') {
      throw new BusinessRuleException(`No se puede activar desde el estado "${entity.status}"`);
    }
    entity.status = 'active';
    return this.repo.save(entity);
  }

  async list(query: PaginationQueryDto, user: AuthenticatedUser) {
    const [items, total] = await this.repo.findAndCount({
      where: user.tenantId ? { tenantId: user.tenantId } : {},
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<ExampleEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new EntityNotFoundException('ExampleEntity', id);
    return entity;
  }

  async update(id: string, dto: UpdateExampleDto, user: AuthenticatedUser): Promise<ExampleEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto, { updatedBy: user.id });
    return this.repo.save(entity);
  }

  /** Borrado lógico (deletedAt) — estrategia por defecto (§19). */
  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.softRemove(entity);
  }
}

@ApiTags('example')
@ApiBearerAuth()
@Controller('example')
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Get()
  @ApiOperation({ summary: 'Listar entidades de ejemplo (paginado, filtrado por tenant)' })
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una entidad de ejemplo por id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Idempotent()
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia (UUID)' })
  @ApiOperation({ summary: 'Crear entidad de ejemplo (idempotente + outbox transaccional)' })
  create(@Body() dto: CreateExampleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una entidad de ejemplo' })
  update(@Param('id') id: string, @Body() dto: UpdateExampleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activar (transición de flujo de ejemplo)' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar (borrado lógico) una entidad de ejemplo' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([ExampleEntity])],
  controllers: [ExampleController],
  providers: [ExampleService],
})
export class ExampleModule {}
