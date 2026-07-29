import { Controller, Get, Injectable, Module, Param, Query } from '@nestjs/common';
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

@Module({
  imports: [DatabaseModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
