import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Historial de ejecuciones de jobs programados. */
@Entity('job_runs')
export class JobRun extends BaseEntity {
  @Index()
  @Column()
  job!: string;

  @Column({ default: 'running' })
  status!: string; // running | success | failed | skipped

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ nullable: true })
  error?: string;
}
