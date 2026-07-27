import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseModule } from '@icms/database';
import { PaginationQueryDto, paginate } from '@icms/common';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  record(entry: Partial<AuditLog>): Promise<AuditLog> {
    return this.logs.save(this.logs.create(entry));
  }

  async list(query: PaginationQueryDto) {
    const [items, total] = await this.logs.findAndCount({
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
  list(@Query() query: PaginationQueryDto) {
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
