import { Column, Entity, Index } from 'typeorm';
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseEntity, DatabaseModule } from '@icms/database';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Index({ unique: true })
  @Column()
  key!: string; // p.ej. "organization:write"

  @Column({ nullable: true })
  description?: string;
}

@Entity('roles')
export class Role extends BaseEntity {
  @Index({ unique: true })
  @Column()
  name!: string;

  @Column('simple-array', { default: '' })
  permissionKeys!: string[];
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
  ) {}

  listRoles() {
    return this.roles.find();
  }

  listPermissions() {
    return this.permissions.find();
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get('roles')
  roles() {
    return this.service.listRoles();
  }

  @Get()
  permissions() {
    return this.service.listPermissions();
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Role, Permission])],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
