import { Column, Entity, Index } from 'typeorm';
import { Body, Controller, Get, Injectable, Module, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IsBoolean, IsDefined, IsOptional, IsString } from 'class-validator';
import { BaseEntity, DatabaseModule } from '@icms/database';
import { OutboxService } from '@icms/messaging';
import { Idempotent } from '@icms/redis';
import { RequirePermissions } from '@icms/auth';
import { EventNames } from '@icms/contracts';

@Entity('catalogs')
export class CatalogItem extends BaseEntity {
  @Index()
  @Column()
  catalog!: string; // nombre del catálogo (p.ej. "countries")

  @Column()
  key!: string;

  @Column()
  label!: string;

  @Column({ default: true })
  enabled!: boolean;
}

@Entity('parameters')
export class Parameter extends BaseEntity {
  @Index({ unique: true })
  @Column()
  key!: string;

  @Column('jsonb')
  value!: unknown;
}

class CreateCatalogItemDto {
  @IsString() catalog!: string;
  @IsString() key!: string;
  @IsString() label!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

class UpsertParameterDto {
  @IsString() key!: string;
  @IsDefined() value!: unknown;
}

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(CatalogItem) private readonly items: Repository<CatalogItem>,
    @InjectRepository(Parameter) private readonly parameters: Repository<Parameter>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  listCatalog(catalog: string) {
    return this.items.find({ where: { catalog, enabled: true } });
  }

  createCatalogItem(dto: CreateCatalogItemDto) {
    return this.items.save(this.items.create(dto));
  }

  listParameters() {
    return this.parameters.find();
  }

  /** Crea o actualiza un parámetro por su clave única (upsert). */
  async upsertParameter(dto: UpsertParameterDto) {
    const existing = await this.parameters.findOne({ where: { key: dto.key } });
    if (existing) {
      existing.value = dto.value;
      return this.parameters.save(existing);
    }
    return this.parameters.save(this.parameters.create(dto));
  }

  /** Publica los cambios de configuración (Outbox transaccional) para invalidar cachés. */
  async publish() {
    await this.dataSource.transaction(async (manager) => {
      await this.outbox.enqueue(manager, EventNames.ConfigurationPublished, {
        at: new Date().toISOString(),
      });
    });
    return { published: true };
  }
}

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  @Get('parameters')
  @ApiOperation({ summary: 'Listar parámetros de configuración' })
  parameters() {
    return this.service.listParameters();
  }

  @Put('parameters')
  @RequirePermissions('configuration:write')
  @ApiOperation({ summary: 'Crear o actualizar un parámetro por clave (upsert)' })
  upsertParameter(@Body() dto: UpsertParameterDto) {
    return this.service.upsertParameter(dto);
  }

  @Post('items')
  @RequirePermissions('configuration:write')
  @ApiOperation({ summary: 'Crear un elemento de catálogo' })
  createItem(@Body() dto: CreateCatalogItemDto) {
    return this.service.createCatalogItem(dto);
  }

  @Get(':catalog')
  @ApiOperation({ summary: 'Listar los elementos habilitados de un catálogo' })
  list(@Param('catalog') catalog: string) {
    return this.service.listCatalog(catalog);
  }

  @Post('publish')
  @Idempotent()
  @ApiOperation({ summary: 'Publicar cambios de configuración (idempotente + outbox)' })
  publish() {
    return this.service.publish();
  }
}

@Module({
  imports: [DatabaseModule.forFeature([CatalogItem, Parameter])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
