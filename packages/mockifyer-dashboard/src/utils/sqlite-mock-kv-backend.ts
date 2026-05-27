import type { MockKvBackend, MockKvMulti } from './mock-kv-backend';

function requireBetterSqlite3(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(/* webpackIgnore: true */ 'better-sqlite3');
  } catch {
    throw new Error(
      "SQLite mock store requires optional dependency 'better-sqlite3'. Install: npm install better-sqlite3"
    );
  }
}

function globToLike(pattern: string): string {
  return pattern.replace(/[\\_%]/g, (c) => `\\${c}`).replace(/\*/g, '%');
}

class SqliteKvMulti implements MockKvMulti {
  private readonly ops: Array<() => void> = [];

  constructor(private readonly db: any) {}

  set(key: string, value: string): MockKvMulti {
    this.ops.push(() => {
      this.db
        .prepare(
          `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, NULL)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = NULL`
        )
        .run(key, value);
    });
    return this;
  }

  sadd(key: string, ...members: string[]): MockKvMulti {
    if (members.length === 0) return this;
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO set_members (set_key, member) VALUES (?, ?)`
    );
    this.ops.push(() => {
      for (const m of members) {
        stmt.run(key, m);
      }
    });
    return this;
  }

  del(key: string): MockKvMulti {
    this.ops.push(() => {
      this.db.prepare(`DELETE FROM kv WHERE key = ?`).run(key);
      this.db.prepare(`DELETE FROM set_members WHERE set_key = ?`).run(key);
      this.db.prepare(`DELETE FROM hash_fields WHERE hash_key = ?`).run(key);
      this.db.prepare(`DELETE FROM zset_members WHERE zset_key = ?`).run(key);
    });
    return this;
  }

  async exec(): Promise<unknown> {
    const run = this.db.transaction(() => {
      for (const op of this.ops) {
        op();
      }
    });
    run();
    return undefined;
  }
}

export class SqliteMockKvBackend implements MockKvBackend {
  private readonly db: any;

  constructor(dbPath: string) {
    const Database = requireBetterSqlite3();
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS set_members (
        set_key TEXT NOT NULL,
        member TEXT NOT NULL,
        PRIMARY KEY (set_key, member)
      );
      CREATE TABLE IF NOT EXISTS hash_fields (
        hash_key TEXT NOT NULL,
        field TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (hash_key, field)
      );
      CREATE TABLE IF NOT EXISTS zset_members (
        zset_key TEXT NOT NULL,
        member TEXT NOT NULL,
        score REAL NOT NULL,
        PRIMARY KEY (zset_key, member)
      );
      CREATE INDEX IF NOT EXISTS idx_kv_key ON kv(key);
    `);
  }

  private purgeExpired(): void {
    const now = Date.now();
    this.db.prepare(`DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at <= ?`).run(now);
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired();
    const row = this.db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async set(key: string, value: string, expiryMode?: 'EX', ttlSec?: number): Promise<void> {
    const expiresAt =
      expiryMode === 'EX' && ttlSec != null ? Date.now() + ttlSec * 1000 : null;
    this.db
      .prepare(
        `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
      )
      .run(key, value, expiresAt);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const delKv = this.db.prepare(`DELETE FROM kv WHERE key = ?`);
    const delSet = this.db.prepare(`DELETE FROM set_members WHERE set_key = ?`);
    const delHash = this.db.prepare(`DELETE FROM hash_fields WHERE hash_key = ?`);
    const delZ = this.db.prepare(`DELETE FROM zset_members WHERE zset_key = ?`);
    const run = this.db.transaction(() => {
      for (const key of keys) {
        delKv.run(key);
        delSet.run(key);
        delHash.run(key);
        delZ.run(key);
      }
    });
    run();
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    this.purgeExpired();
    if (keys.length === 0) return [];
    const stmt = this.db.prepare(`SELECT value FROM kv WHERE key = ?`);
    return keys.map((key) => {
      const row = stmt.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    });
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO set_members (set_key, member) VALUES (?, ?)`);
    const run = this.db.transaction(() => {
      for (const m of members) {
        stmt.run(key, m);
      }
    });
    run();
  }

  async smembers(key: string): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT member FROM set_members WHERE set_key = ? ORDER BY member`)
      .all(key) as Array<{ member: string }>;
    return rows.map((r) => r.member);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    const stmt = this.db.prepare(`DELETE FROM set_members WHERE set_key = ? AND member = ?`);
    const run = this.db.transaction(() => {
      for (const m of members) {
        stmt.run(key, m);
      }
    });
    run();
  }

  async hget(key: string, field: string): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT value FROM hash_fields WHERE hash_key = ? AND field = ?`)
      .get(key, field) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO hash_fields (hash_key, field, value) VALUES (?, ?, ?)
         ON CONFLICT(hash_key, field) DO UPDATE SET value = excluded.value`
      )
      .run(key, field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    const stmt = this.db.prepare(`DELETE FROM hash_fields WHERE hash_key = ? AND field = ?`);
    const run = this.db.transaction(() => {
      for (const f of fields) {
        stmt.run(key, f);
      }
    });
    run();
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO zset_members (zset_key, member, score) VALUES (?, ?, ?)
         ON CONFLICT(zset_key, member) DO UPDATE SET score = excluded.score`
      )
      .run(key, member, score);
  }

  async zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]> {
    let withScores = false;
    let limitOffset = 0;
    let limitCount = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === 'WITHSCORES') {
        withScores = true;
      } else if (a === 'LIMIT' && typeof args[i + 1] === 'number' && typeof args[i + 2] === 'number') {
        limitOffset = args[i + 1] as number;
        limitCount = args[i + 2] as number;
        i += 2;
      }
    }

    const rows = this.db
      .prepare(
        `SELECT member, score FROM zset_members
         WHERE zset_key = ? AND score >= ? AND score <= ?
         ORDER BY score DESC, member ASC`
      )
      .all(key, min, max) as Array<{ member: string; score: number }>;

    const slice = rows.slice(limitOffset, limitOffset + limitCount);
    if (!withScores) {
      return slice.map((r) => r.member);
    }
    const flat: string[] = [];
    for (const r of slice) {
      flat.push(r.member, String(r.score));
    }
    return flat;
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    this.db
      .prepare(`DELETE FROM zset_members WHERE zset_key = ? AND score >= ? AND score <= ?`)
      .run(key, min, max);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM zset_members WHERE zset_key = ? AND score >= ? AND score <= ?`
      )
      .get(key, min, max) as { c: number };
    return row?.c ?? 0;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const like = globToLike(pattern);
    const out = new Set<string>();
    const kvRows = this.db.prepare(`SELECT key FROM kv WHERE key LIKE ? ESCAPE '\\'`).all(like) as Array<{
      key: string;
    }>;
    for (const r of kvRows) {
      out.add(r.key);
    }
    const setRows = this.db
      .prepare(`SELECT DISTINCT set_key AS key FROM set_members WHERE set_key LIKE ? ESCAPE '\\'`)
      .all(like) as Array<{ key: string }>;
    for (const r of setRows) {
      out.add(r.key);
    }
    const hashRows = this.db
      .prepare(`SELECT DISTINCT hash_key AS key FROM hash_fields WHERE hash_key LIKE ? ESCAPE '\\'`)
      .all(like) as Array<{ key: string }>;
    for (const r of hashRows) {
      out.add(r.key);
    }
    return Array.from(out);
  }

  multi(): MockKvMulti {
    return new SqliteKvMulti(this.db);
  }

  async ping(): Promise<void> {
    this.db.prepare(`SELECT 1`).get();
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
