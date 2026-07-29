import { Body, Controller, Injectable, Logger, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
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
