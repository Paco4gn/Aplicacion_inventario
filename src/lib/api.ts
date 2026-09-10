export interface AppUser {
  id: string;
  email: string;
}

export interface AppSession {
  user: AppUser;
}

interface ApiError {
  message: string;
}

// The compatibility client intentionally carries the page-specific row shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface QueryResult<T = any> {
  data: T;
  error: ApiError | null;
  count: number | null;
}

type Filter = {
  type: 'eq' | 'neq' | 'is' | 'in' | 'not_is' | 'gte' | 'lte' | 'ilike' | 'or';
  column?: string;
  value: unknown;
};

class QueryBuilder implements PromiseLike<QueryResult> {
  private payload: Record<string, unknown> = {
    action: 'select',
    select: '*',
    filters: [] as Filter[],
    order: [] as Array<{ column: string; ascending: boolean }>,
  };

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.payload.select = columns;
    this.payload.count = options?.count === 'exact';
    this.payload.head = options?.head === true;
    if (this.payload.action !== 'select') this.payload.returning = true;
    return this;
  }

  insert(values: unknown) {
    this.payload.action = 'insert';
    this.payload.values = values;
    return this;
  }

  update(values: unknown) {
    this.payload.action = 'update';
    this.payload.values = values;
    return this;
  }

  delete() {
    this.payload.action = 'delete';
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.payload.action = 'upsert';
    this.payload.values = values;
    this.payload.onConflict = options?.onConflict;
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter('eq', column, value); }
  neq(column: string, value: unknown) { return this.addFilter('neq', column, value); }
  is(column: string, value: unknown) { return this.addFilter('is', column, value); }
  in(column: string, value: unknown[]) { return this.addFilter('in', column, value); }
  gte(column: string, value: unknown) { return this.addFilter('gte', column, value); }
  lte(column: string, value: unknown) { return this.addFilter('lte', column, value); }
  ilike(column: string, value: unknown) { return this.addFilter('ilike', column, value); }

  not(column: string, operator: 'is', value: unknown) {
    if (operator !== 'is') throw new Error(`Operador no admitido: ${operator}`);
    return this.addFilter('not_is', column, value);
  }

  or(expression: string) {
    (this.payload.filters as Filter[]).push({ type: 'or', value: expression });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    (this.payload.order as Array<{ column: string; ascending: boolean }>).push({
      column,
      ascending: options?.ascending !== false,
    });
    return this;
  }

  limit(value: number) {
    this.payload.limit = value;
    return this;
  }

  maybeSingle() {
    this.payload.maybeSingle = true;
    return this;
  }

  private addFilter(type: Filter['type'], column: string, value: unknown) {
    (this.payload.filters as Filter[]).push({ type, column, value });
    return this;
  }

  private async execute(): Promise<QueryResult> {
    try {
      const response = await fetch(`/api/data/${encodeURIComponent(this.table)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.payload),
      });
      const result = await response.json() as QueryResult & { error?: ApiError | string };
      if (!response.ok) {
        const message = typeof result.error === 'string' ? result.error : result.error?.message;
        return { data: null, count: null, error: { message: message || 'El servicio no pudo completar la operación' } };
      }
      return { data: result.data ?? null, count: result.count ?? null, error: null };
    } catch {
      return { data: null, count: null, error: { message: 'No se pudo conectar con el servicio de inventario' } };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function postFunction(name: string, body: unknown) {
  try {
    const response = await fetch(`/api/functions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return response.ok
      ? { data, error: null }
      : { data, error: { message: (data as { error?: string }).error || 'No se pudo ejecutar la operación' } };
  } catch {
    return { data: null, error: { message: 'No se pudo conectar con el servicio' } };
  }
}

export const api = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth: {
    async getSession(): Promise<{ data: { session: AppSession | null } }> {
      try {
        const response = await fetch('/api/session', { headers: { Accept: 'application/json' } });
        if (!response.ok) return { data: { session: null } };
        const data = await response.json() as { user?: AppUser };
        return { data: { session: data.user ? { user: data.user } : null } };
      } catch {
        return { data: { session: null } };
      }
    },
    async getUser(): Promise<{ data: { user: AppUser | null } }> {
      const { data } = await this.getSession();
      return { data: { user: data.session?.user ?? null } };
    },
    signOut() {
      window.location.assign(`/signout-with-chatgpt?return_to=${encodeURIComponent('/')}`);
    },
  },
  functions: {
    invoke(name: string, options: { body: unknown }) {
      return postFunction(name, options.body);
    },
  },
};
