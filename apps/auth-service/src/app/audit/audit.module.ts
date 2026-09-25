import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermissions } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { PaginationQueryDto, paginate } from '@icms/common';
import { AuditLog } from './audit-log.entity';

/** Permiso para consultar la auditoría de seguridad y la bitácora del dominio. */
export const PERMISO_AUDITORIA = 'auditoria:consultar';

class AuditQuery extends PaginationQueryDto {
  @IsOptional() @IsUUID() userId?: string;
  /** Acción exacta, p. ej. login, usuario.creado, password.cambiado. */
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  /** Rango [desde, hasta) sobre la fecha del evento. */
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  record(entry: Partial<AuditLog>): Promise<AuditLog> {
    return this.logs.save(this.logs.create(entry));
  }

  async list(query: AuditQuery) {
    const where: FindOptionsWhere<AuditLog> = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    if (query.desde && query.hasta) {
      where.createdAt = Between(new Date(query.desde), new Date(query.hasta));
    } else if (query.desde) {
      where.createdAt = MoreThanOrEqual(new Date(query.desde));
    } else if (query.hasta) {
      where.createdAt = LessThan(new Date(query.hasta));
    }
    const [items, total] = await this.logs.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(items, total, query);
  }
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISO_AUDITORIA)
  @ApiOperation({
    summary: 'Auditoría de seguridad: logins, sesiones, contraseñas y usuarios (filtrable)',
  })
  list(@Query() query: AuditQuery) {
    return this.audit.list(query);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
