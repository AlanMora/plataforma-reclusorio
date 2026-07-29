import { Column, Entity, Index } from 'typeorm';
import { Body, Controller, Get, Injectable, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { BaseEntity, DatabaseModule } from '@icms/database';
import { RequirePermissions } from '@icms/auth';

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

class CreateRoleDto {
  @IsString() name!: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) permissionKeys!: string[];
}

class CreatePermissionDto {
  @IsString() key!: string;
  @IsOptional() @IsString() description?: string;
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

  createRole(dto: CreateRoleDto) {
    return this.roles.save(this.roles.create(dto));
  }

  listPermissions() {
    return this.permissions.find();
  }

  createPermission(dto: CreatePermissionDto) {
    return this.permissions.save(this.permissions.create(dto));
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles' })
  roles() {
    return this.service.listRoles();
  }

  @Post('roles')
  @RequirePermissions('permissions:write')
  @ApiOperation({ summary: 'Crear un rol con sus permisos' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.service.createRole(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar permisos disponibles' })
  permissions() {
    return this.service.listPermissions();
  }

  @Post()
  @RequirePermissions('permissions:write')
  @ApiOperation({ summary: 'Registrar un permiso' })
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.service.createPermission(dto);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Role, Permission])],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
