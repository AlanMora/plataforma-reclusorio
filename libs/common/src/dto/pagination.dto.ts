import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Parámetros de paginación reutilizables para endpoints de listado. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  query: Pick<PaginationQueryDto, 'page' | 'limit'>,
): PaginatedResult<T> {
  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit) || 0,
  };
}
