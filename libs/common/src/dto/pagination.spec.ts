import { paginate, PaginationQueryDto } from './pagination.dto';

describe('paginate', () => {
  const query = (page: number, limit: number): PaginationQueryDto =>
    Object.assign(new PaginationQueryDto(), { page, limit });

  it('calcula totalPages correctamente', () => {
    expect(paginate([1, 2, 3], 25, query(2, 10))).toEqual({
      items: [1, 2, 3],
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it('devuelve 0 páginas cuando no hay resultados', () => {
    expect(paginate([], 0, query(1, 20)).totalPages).toBe(0);
  });
});
