import { Controller, Get, Injectable, Logger, Module, OnApplicationBootstrap, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argon2Hash } from '@node-rs/argon2';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { User } from './user.entity';

/** Vista pública de un usuario: nunca expone el hash de la contraseña. */
type SafeUser = Omit<User, 'passwordHash'>;

function toSafeUser(user: User): SafeUser {
  const safe = { ...user } as Partial<User>;
  delete safe.passwordHash;
  return safe as SafeUser;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuario', id);
    return toSafeUser(user);
  }

  async list(query: PaginationQueryDto, tenantId?: string) {
    const [items, total] = await this.users.findAndCount({
      where: tenantId ? { tenantId } : {},
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items.map(toSafeUser), total, query);
  }
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findById(user.id);
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuarios del tenant (paginado)' })
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.list(query, user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Obtener un usuario por id' })
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }
}

/** Permisos completos del dominio reclusorio (los 23 de la matriz RF). */
const PERMISOS_RECLUSORIO = [
  'personas:consultar', 'personas:crear', 'personas:modificar',
  'elementos:consultar', 'elementos:crear', 'elementos:modificar',
  'ingresos:consultar', 'ingresos:crear',
  'movimientos:consultar', 'movimientos:crear',
  'audiencias:consultar', 'audiencias:crear', 'audiencias:asociar',
  'traslados:consultar', 'traslados:crear', 'traslados:asociar',
  'incidencias:consultar', 'incidencias:crear', 'incidencias:asociar',
  'archivos:consultar', 'archivos:crear', 'archivos:administrar',
  'catalogos:administrar',
].join(',');

/**
 * Usuario semilla de DESARROLLO (opt-in explícito por env).
 * Crea/actualiza al arrancar un usuario con todos los permisos del dominio
 * para poder entrar al frontend sin pasos manuales. Nunca se activa solo:
 * exige SEED_ADMIN_ENABLED=true y jamás debe habilitarse en producción.
 */
@Injectable()
export class DevAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevAdminSeeder.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('SEED_ADMIN_ENABLED') !== 'true') return;
    const email = this.config.get<string>('SEED_ADMIN_EMAIL');
    const password = this.config.get<string>('SEED_ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn('SEED_ADMIN_ENABLED=true pero faltan SEED_ADMIN_EMAIL/PASSWORD; se omite');
      return;
    }
    const permissions = (this.config.get<string>('SEED_ADMIN_PERMISSIONS') ?? PERMISOS_RECLUSORIO)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const existente = await this.users.findOne({ where: { email } });
    if (existente) {
      existente.permissions = permissions;
      existente.isActive = true;
      await this.users.save(existente);
      this.logger.log(`Usuario semilla "${email}" actualizado (${permissions.length} permisos)`);
      return;
    }
    await this.users.save(
      this.users.create({
        email,
        passwordHash: await argon2Hash(password),
        isActive: true,
        roles: ['admin'],
        permissions,
      }),
    );
    this.logger.log(`Usuario semilla "${email}" creado (${permissions.length} permisos)`);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, DevAdminSeeder],
  exports: [UsersService],
})
export class UsersModule {}
