import { Body, Controller, Get, Injectable, Module, Param, Post } from '@nestjs/common';
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

  async list(query: PaginationQueryDto) {
    const [items, total] = await this.repo.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query);
  }
}

@ApiTags('example')
@ApiBearerAuth()
@Controller('example')
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Get()
  list(@Body() _b: unknown, @CurrentUser() _u: AuthenticatedUser) {
    return this.service.list(new PaginationQueryDto());
  }

  @Post()
  @Idempotent()
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia (UUID)' })
  @ApiOperation({ summary: 'Crear entidad de ejemplo (idempotente + outbox transaccional)' })
  create(@Body() dto: CreateExampleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activar (transición de flujo de ejemplo)' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([ExampleEntity])],
  controllers: [ExampleController],
  providers: [ExampleService],
})
export class ExampleModule {}
