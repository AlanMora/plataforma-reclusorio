import { Column, Entity, Index } from 'typeorm';
import { Controller, Get, Injectable, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseEntity, DatabaseModule } from '@icms/database';
import { OutboxService } from '@icms/messaging';
import { Idempotent } from '@icms/redis';
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

  listParameters() {
    return this.parameters.find();
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
  parameters() {
    return this.service.listParameters();
  }

  @Get(':catalog')
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
