import { Controller, Get, Injectable, Logger, Module } from '@nestjs/common';
import { ScheduleModule, Cron } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseModule } from '@icms/database';
import { DistributedLockService } from './distributed-lock.service';
import { JobRun } from './job-run.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(JobRun) private readonly runs: Repository<JobRun>,
    private readonly lock: DistributedLockService,
  ) {}

  history() {
    return this.runs.find({ order: { startedAt: 'DESC' }, take: 100 });
  }

  /**
   * Job de ejemplo: se ejecuta cada minuto pero SÓLO en una instancia gracias
   * al lock distribuido. Registra la ejecución en el historial.
   */
  @Cron('0 * * * * *', { name: 'example-heartbeat' })
  async heartbeat(): Promise<void> {
    await this.lock.runExclusive('example-heartbeat', 55_000, async () => {
      const run = await this.runs.save(
        this.runs.create({ job: 'example-heartbeat', status: 'running', startedAt: new Date() }),
      );
      try {
        // TODO(proyecto): trabajo real del job.
        run.status = 'success';
      } catch (err) {
        run.status = 'failed';
        run.error = (err as Error).message;
      } finally {
        run.finishedAt = new Date();
        run.attempts += 1;
        await this.runs.save(run);
      }
    });
  }
}

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  @Get('runs')
  runs() {
    return this.service.history();
  }
}

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule.forFeature([JobRun])],
  controllers: [SchedulerController],
  providers: [SchedulerService, DistributedLockService],
})
export class SchedulerModule {}
