import { DynamicModule, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxEvent, OutboxEvent } from './outbox.entities';
import { OutboxService } from './outbox.service';
import { InboxService } from './inbox.service';
import { OutboxRelay } from './outbox-relay.service';

/**
 * Módulo Outbox/Inbox. Registra las entidades y expone OutboxService (encolar en
 * transacción) e InboxService (dedup de consumidores). Con `withRelay: true`
 * arranca el relay que publica los eventos pendientes.
 *
 * Requiere que el servicio ya tenga configurado TypeORM (DatabaseModule.forRoot)
 * y MessagingModule.forRoot, y que registre las entidades OutboxEvent/InboxEvent
 * en su conexión.
 */
@Module({})
export class OutboxModule {
  static forRoot(options: { withRelay?: boolean } = {}): DynamicModule {
    return {
      module: OutboxModule,
      global: true,
      imports: [
        TypeOrmModule.forFeature([OutboxEvent, InboxEvent]),
        ...(options.withRelay ? [ScheduleModule.forRoot()] : []),
      ],
      providers: [OutboxService, InboxService, ...(options.withRelay ? [OutboxRelay] : [])],
      exports: [OutboxService, InboxService],
    };
  }
}
