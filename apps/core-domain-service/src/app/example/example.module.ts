import { Body, Controller, Get, Injectable, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { BusinessRuleException, EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';
import { EventPublisher } from '@icms/messaging';
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
    private readonly events: EventPublisher,
  ) {}

  async create(dto: CreateExampleDto, user: AuthenticatedUser) {
    const entity = this.repo.create({ ...dto, tenantId: user.tenantId, status: 'draft' });
    const saved = await this.repo.save(entity);
    await this.events.publish('example.created', { id: saved.id }, { tenantId: user.tenantId });
    return saved;
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
  @ApiOperation({ summary: 'Crear entidad de ejemplo' })
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
