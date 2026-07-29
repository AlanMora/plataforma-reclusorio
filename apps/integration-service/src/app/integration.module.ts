import { Body, Controller, Get, Injectable, Logger, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { Public } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { OutboxService } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import { OutboxMessage } from './outbox.entity';

class EnqueueOutboundDto {
  @IsString() @IsNotEmpty() destination!: string;
  @IsString() @IsNotEmpty() operation!: string;
  @IsObject() payload!: Record<string, unknown>;
}

/**
 * Aísla al dominio de formatos y errores externos. Las salidas se encolan
 * (outbox) para reintento/conciliación; las entradas (webhooks) se normalizan
 * y se publican como eventos de dominio.
 */
@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(OutboxMessage) private readonly outboundRepo: Repository<OutboxMessage>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  enqueueOutbound(dto: EnqueueOutboundDto) {
    return this.outboundRepo.save(this.outboundRepo.create({ ...dto, status: 'pending' }));
  }

  async listOutbound(query: PaginationQueryDto) {
    const [items, total] = await this.outboundRepo.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query);
  }

  async getOutbound(id: string) {
    const message = await this.outboundRepo.findOne({ where: { id } });
    if (!message) throw new EntityNotFoundException('Mensaje de salida', id);
    return message;
  }

  /**
   * Recibe un webhook externo y publica el evento de dominio de forma
   * transaccional (Outbox). TODO(proyecto): validar firma/timestamp/nonce y
   * persistir el crudo antes de procesar (§4.7).
   */
  async handleInboundWebhook(source: string, body: unknown) {
    this.logger.log(`Webhook entrante de "${source}"`);
    await this.dataSource.transaction(async (manager) => {
      await this.outbox.enqueue(manager, EventNames.IntegrationInbound, { source, body });
    });
    return { received: true };
  }
}

@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Get('outbound')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mensajes de salida (paginado)' })
  listOutbound(@Query() query: PaginationQueryDto) {
    return this.service.listOutbound(query);
  }

  @Get('outbound/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener un mensaje de salida por id' })
  getOutbound(@Param('id') id: string) {
    return this.service.getOutbound(id);
  }

  @Post('outbound')
  @Idempotent()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encolar un mensaje de salida (idempotente)' })
  enqueue(@Body() dto: EnqueueOutboundDto) {
    return this.service.enqueueOutbound(dto);
  }

  @Public()
  @Post('webhooks/:source')
  @ApiOperation({ summary: 'Recibir webhook de un sistema externo (outbox transaccional)' })
  webhook(@Param('source') source: string, @Body() body: unknown) {
    return this.service.handleInboundWebhook(source, body);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([OutboxMessage])],
  controllers: [IntegrationController],
  providers: [IntegrationService],
})
export class IntegrationModule {}
