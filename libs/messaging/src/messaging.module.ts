import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { EventPublisher } from './event-publisher.service';

export interface MessagingModuleOptions {
  /** Exchange principal de eventos de dominio (topic). */
  exchange?: string;
}

/**
 * Módulo de mensajería sobre RabbitMQ. Declara un exchange `topic` con su
 * dead-letter exchange asociado y expone el `EventPublisher` para emitir
 * eventos de dominio de forma uniforme.
 */
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions = {}): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      imports: [
        RabbitMQModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const exchange = options.exchange ?? config.get<string>('RABBITMQ_EXCHANGE', 'icms.events');
            return {
              uri: config.get<string>('RABBITMQ_URL', 'amqp://icms:icms@localhost:5672'),
              connectionInitOptions: { wait: false },
              exchanges: [
                { name: exchange, type: 'topic' },
                { name: `${exchange}.dlx`, type: 'topic' },
              ],
            };
          },
        }),
      ],
      providers: [EventPublisher],
      exports: [EventPublisher, RabbitMQModule],
    };
  }
}
