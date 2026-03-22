declare module "better-sqlite3" {
  namespace Database {
    interface Statement {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }

    interface Database {
      pragma(source: string): unknown;
      exec(source: string): this;
      prepare(source: string): Statement;
      transaction<T>(fn: () => T): () => T;
    }
  }

  interface DatabaseConstructor {
    new (filename: string, options?: Record<string, unknown>): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
