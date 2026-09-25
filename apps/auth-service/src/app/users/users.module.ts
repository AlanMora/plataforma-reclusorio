import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argon2Hash } from '@node-rs/argon2';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AllowPendingPasswordChange,
  AuthenticatedUser,
  CurrentUser,
  RequirePermissions,
} from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { EventPublisher } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import {
  BusinessRuleException,
  EntityNotFoundException,
  ForbiddenDomainException,
  PaginationQueryDto,
  paginate,
} from '@icms/common';
import { User } from './user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import {
  normalizarNombre,
  normalizarUsername,
  USERNAME_MENSAJE,
  USERNAME_REGEX,
} from '../auth/dto';
import { AuditModule, AuditService } from '../audit/audit.module';

/** Vista pública de un usuario: nunca expone el hash de la contraseña. */
type SafeUser = Omit<User, 'passwordHash'>;

function toSafeUser(user: User): SafeUser {
  const safe = { ...user } as Partial<User>;
  delete safe.passwordHash;
  return safe as SafeUser;
}

/**
 * Catálogo de permisos administrables por módulo. Es la única fuente para
 * el seeder, la validación del backend y la matriz de checkboxes del
 * frontend (GET /users/permisos-disponibles) — así no hay listas duplicadas
 * que puedan divergir.
 */
export const CATALOGO_PERMISOS: { modulo: string; permisos: string[] }[] = [
  { modulo: 'Personas', permisos: ['personas:consultar', 'personas:crear', 'personas:modificar'] },
  { modulo: 'Elementos', permisos: ['elementos:consultar', 'elementos:crear', 'elementos:modificar'] },
  { modulo: 'Ingresos / Libertades', permisos: ['ingresos:consultar', 'ingresos:crear'] },
  { modulo: 'Movimientos', permisos: ['movimientos:consultar', 'movimientos:crear'] },
  { modulo: 'Audiencias', permisos: ['audiencias:consultar', 'audiencias:crear', 'audiencias:asociar'] },
  { modulo: 'Traslados', permisos: ['traslados:consultar', 'traslados:crear', 'traslados:asociar'] },
  { modulo: 'Incidencias', permisos: ['incidencias:consultar', 'incidencias:crear', 'incidencias:asociar'] },
  { modulo: 'Archivos', permisos: ['archivos:consultar', 'archivos:crear', 'archivos:administrar'] },
  { modulo: 'Catálogos', permisos: ['catalogos:administrar'] },
  // Administración de la plataforma: quién puede gestionar usuarios y permisos.
  { modulo: 'Usuarios (administración)', permisos: ['users:read', 'users:write', 'permissions:write'] },
  // Trazabilidad: auditoría de seguridad (auth) y bitácora del dominio (reclusorio).
  { modulo: 'Auditoría y bitácora', permisos: ['auditoria:consultar'] },
];

const PERMISOS_VALIDOS = new Set(CATALOGO_PERMISOS.flatMap((m) => m.permisos));

/**
 * Rol del superusuario: la cuenta de rescate que siempre puede restablecer
 * contraseñas. Solo otro superusuario puede modificarla, y no se le puede
 * desactivar ni quitar permisos de administración.
 */
export const ROL_SUPERADMIN = 'superadmin';

/** Permisos que un administrador no puede quitarse a sí mismo (anti-bloqueo). */
const PERMISOS_ANTIBLOQUEO = ['users:read', 'users:write', 'permissions:write'];

class ListarUsuariosQuery extends PaginationQueryDto {
  /** Búsqueda por nombre de usuario o nombre completo (homologación de listados). */
  @IsOptional() @IsString() buscar?: string;
}

class CrearUsuarioDto {
  @Transform(normalizarUsername)
  @IsString()
  @Matches(USERNAME_REGEX, { message: USERNAME_MENSAJE })
  username!: string;
  @IsOptional()
  @Transform(normalizarNombre)
  @IsString()
  @MaxLength(150)
  nombre?: string | null;
  /** Contraseña temporal: el usuario deberá cambiarla en su primer ingreso. */
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
}

class ActualizarUsuarioDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Nombre completo; null o vacío lo borra. */
  @IsOptional()
  @Transform(normalizarNombre)
  @IsString()
  @MaxLength(150)
  nombre?: string | null;
}

class CambiarPasswordAdminDto {
  /** Contraseña temporal: el usuario deberá cambiarla en su siguiente ingreso. */
  @IsString() @MinLength(8) password!: string;
}

class AsignarPermisosDto {
  @IsArray()
  @ArrayNotEmpty()
  @Matches(/^[a-z]+:[a-z]+$/, {
    each: true,
    message: 'Cada permiso debe tener el formato modulo:accion (p. ej. personas:crear)',
  })
  permissions!: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly events: EventPublisher,
  ) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuario', id);
    return toSafeUser(user);
  }

  async list(query: PaginationQueryDto, tenantId?: string, buscar?: string) {
    const tenant = tenantId ? { tenantId } : {};
    const texto = buscar?.trim();
    const filtro = texto
      ? [
          { ...tenant, username: ILike(`%${texto}%`) },
          { ...tenant, nombre: ILike(`%${texto}%`) },
        ]
      : tenant;
    const [items, total] = await this.users.findAndCount({
      where: filtro,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items.map(toSafeUser), total, query);
  }

  private validarPermisos(permissions: string[]): string[] {
    const desconocidos = permissions.filter((p) => !PERMISOS_VALIDOS.has(p));
    if (desconocidos.length > 0) {
      throw new BusinessRuleException(
        `Permisos desconocidos: ${desconocidos.join(', ')}`,
      );
    }
    return [...new Set(permissions)];
  }

  /** Solo un superusuario puede modificar la cuenta de otro superusuario. */
  private protegerSuperusuario(objetivo: User, actor: AuthenticatedUser): void {
    if (objetivo.roles.includes(ROL_SUPERADMIN) && !actor.roles.includes(ROL_SUPERADMIN)) {
      throw new ForbiddenDomainException('Solo un superusuario puede modificar al superusuario');
    }
  }

  async crear(dto: CrearUsuarioDto, actor: AuthenticatedUser): Promise<SafeUser> {
    const existente = await this.users.findOne({ where: { username: dto.username } });
    if (existente) {
      throw new BusinessRuleException('Ya existe un usuario con ese nombre de usuario');
    }
    const user = await this.users.save(
      this.users.create({
        username: dto.username,
        nombre: dto.nombre ?? null,
        passwordHash: await argon2Hash(dto.password),
        // La contraseña la eligió el administrador: se cambia al primer ingreso.
        mustChangePassword: true,
        isActive: true,
        roles: ['user'],
        permissions: this.validarPermisos(dto.permissions ?? []),
      }),
    );
    await this.audit.record({
      userId: actor.id,
      action: 'usuario.creado',
      outcome: user.username,
      metadata: { nuevoUsuarioId: user.id, permisos: user.permissions.length },
    });
    return toSafeUser(user);
  }

  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuario', id);
    this.protegerSuperusuario(user, actor);

    if (dto.isActive === false && id === actor.id) {
      throw new BusinessRuleException('No puedes desactivar tu propia cuenta');
    }
    if (dto.isActive === false && user.roles.includes(ROL_SUPERADMIN)) {
      throw new BusinessRuleException('El superusuario no se puede desactivar');
    }

    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.nombre !== undefined) user.nombre = dto.nombre;
    const guardado = await this.users.save(user);

    // Desactivar corta el acceso de inmediato: sesiones fuera (RF-SES-009).
    if (dto.isActive === false) {
      await this.auth.revokeAllForUser(id, 'revocacion-administrativa');
    }
    await this.audit.record({
      userId: actor.id,
      action: 'usuario.actualizado',
      outcome: guardado.username,
      metadata: { usuarioId: id, isActive: guardado.isActive, nombre: guardado.nombre },
    });
    return toSafeUser(guardado);
  }

  async cambiarPassword(
    id: string,
    dto: CambiarPasswordAdminDto,
    actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuario', id);
    this.protegerSuperusuario(user, actor);
    user.passwordHash = await argon2Hash(dto.password);
    // Contraseña temporal: al siguiente ingreso se le pide cambiarla (salvo
    // que el administrador se la restablezca a sí mismo).
    user.mustChangePassword = id !== actor.id;
    await this.users.save(user);
    // La contraseña cambió: cualquier sesión previa deja de ser confiable.
    await this.auth.revokeAllForUser(id, 'cambio-password');
    await this.audit.record({
      userId: actor.id,
      action: 'usuario.password-restablecida',
      outcome: user.username,
      metadata: { usuarioId: id },
    });
    return { ok: true };
  }

  async asignarPermisos(
    id: string,
    dto: AsignarPermisosDto,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuario', id);
    this.protegerSuperusuario(user, actor);

    const permisos = this.validarPermisos(dto.permissions);

    // Anti-bloqueo: al editar tus propios permisos debes conservar los de
    // administración; si no, nadie podría volver a administrar usuarios.
    if (id === actor.id || user.roles.includes(ROL_SUPERADMIN)) {
      const faltantes = PERMISOS_ANTIBLOQUEO.filter((p) => !permisos.includes(p));
      if (faltantes.length > 0) {
        throw new BusinessRuleException(
          id === actor.id
            ? `No puedes quitarte tus propios permisos de administración (${faltantes.join(', ')})`
            : `No se le pueden quitar al superusuario los permisos de administración (${faltantes.join(', ')})`,
        );
      }
    }

    user.permissions = permisos;
    const guardado = await this.users.save(user);

    // Notificación en TIEMPO REAL vía WebSocket / RabbitMQ (RF-SES-009 / DP-009):
    // el cliente conectado refresca inmediatamente sus claims y actualiza la UI.
    await this.events.publish(EventNames.UserPermissionsUpdated, {
      userId: id,
      permissions: guardado.permissions,
    });

    await this.audit.record({
      userId: actor.id,
      action: 'usuario.permisos-asignados',
      outcome: guardado.username,
      metadata: { usuarioId: id, total: permisos.length },
    });
    return toSafeUser(guardado);
  }
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findById(user.id);
  }

  // Antes de ':id' para que la ruta literal no sea capturada por el parámetro.
  @Get('permisos-disponibles')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Catálogo de permisos agrupado por módulo (matriz del frontend)' })
  permisosDisponibles() {
    return CATALOGO_PERMISOS;
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuarios del tenant (paginado, con búsqueda por nombre de usuario)' })
  list(@Query() query: ListarUsuariosQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.users.list(query, user.tenantId, query.buscar);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Obtener un usuario por id' })
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Post()
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Crear usuario con contraseña temporal y permisos iniciales' })
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.crear(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Editar nombre o activar/desactivar usuario (desactivar revoca sus sesiones)' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.actualizar(id, dto, actor);
  }

  @Patch(':id/password')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Restablecer contraseña temporal (revoca sesiones; se cambia al siguiente ingreso)' })
  cambiarPassword(
    @Param('id') id: string,
    @Body() dto: CambiarPasswordAdminDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.cambiarPassword(id, dto, actor);
  }

  @Put(':id/permissions')
  @RequirePermissions('permissions:write')
  @ApiOperation({
    summary: 'Asignar permisos (sin cerrar sesión: aplican en la siguiente renovación del token)',
  })
  asignarPermisos(
    @Param('id') id: string,
    @Body() dto: AsignarPermisosDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.asignarPermisos(id, dto, actor);
  }
}

/** Todos los permisos del catálogo (dominio + administración) para el seeder. */
const PERMISOS_RECLUSORIO = CATALOGO_PERMISOS.flatMap((m) => m.permisos).join(',');

/**
 * Superusuario semilla (opt-in explícito por env).
 * Crea/actualiza al arrancar el superusuario con todos los permisos: la
 * cuenta de rescate que restablece contraseñas olvidadas. Nunca se activa
 * solo: exige SEED_ADMIN_ENABLED=true. Si el propio superusuario olvida su
 * contraseña, SEED_ADMIN_RESET_PASSWORD=true la regresa a
 * SEED_ADMIN_PASSWORD en el siguiente arranque (quitar la variable después).
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
    const username = this.config.get<string>('SEED_ADMIN_USERNAME')?.trim().toLowerCase();
    const password = this.config.get<string>('SEED_ADMIN_PASSWORD');
    if (!username || !password) {
      this.logger.warn('SEED_ADMIN_ENABLED=true pero faltan SEED_ADMIN_USERNAME/PASSWORD; se omite');
      return;
    }
    const permissions = (this.config.get<string>('SEED_ADMIN_PERMISSIONS') ?? PERMISOS_RECLUSORIO)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const existente = await this.users.findOne({ where: { username } });
    if (existente) {
      existente.permissions = permissions;
      existente.roles = [...new Set([...(existente.roles ?? []), ROL_SUPERADMIN])];
      existente.isActive = true;
      const restablecer = this.config.get<string>('SEED_ADMIN_RESET_PASSWORD') === 'true';
      if (restablecer) {
        existente.passwordHash = await argon2Hash(password);
        existente.mustChangePassword = false;
      }
      await this.users.save(existente);
      this.logger.log(
        `Superusuario "${username}" actualizado (${permissions.length} permisos` +
          `${restablecer ? ', contraseña restablecida' : ''})`,
      );
      return;
    }
    await this.users.save(
      this.users.create({
        username,
        passwordHash: await argon2Hash(password),
        mustChangePassword: false,
        isActive: true,
        roles: [ROL_SUPERADMIN],
        permissions,
      }),
    );
    this.logger.log(`Superusuario "${username}" creado (${permissions.length} permisos)`);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([User]), AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService, DevAdminSeeder],
  exports: [UsersService],
})
export class UsersModule {}
