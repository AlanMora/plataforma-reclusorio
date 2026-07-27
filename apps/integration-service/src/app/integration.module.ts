import { Body, Controller, Injectable, Logger, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { Public } from '@icms/auth';
import { EventPublisher } from '@icms/messaging';
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
    @InjectRepository(OutboxMessage) private readonly outbox: Repository<OutboxMessage>,
    private readonly events: EventPublisher,
  ) {}

  enqueueOutbound(dto: EnqueueOutboundDto) {
    return this.outbox.save(this.outbox.create({ ...dto, status: 'pending' }));
  }

  /** Recibe un webhook externo, lo transforma y lo publica hacia el dominio. */
  async handleInboundWebhook(source: string, body: unknown) {
    this.logger.log(`Webhook entrante de "${source}"`);
    // TODO(proyecto): validar firma del webhook y transformar el formato externo.
    await this.events.publish(EventNames.IntegrationInbound, { source, body });
    return { received: true };
  }
}

@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Post('outbound')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encolar un mensaje de salida (outbox)' })
  enqueue(@Body() dto: EnqueueOutboundDto) {
    return this.service.enqueueOutbound(dto);
  }

  @Public()
  @Post('webhooks/:source')
  @ApiOperation({ summary: 'Recibir webhook de un sistema externo' })
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
