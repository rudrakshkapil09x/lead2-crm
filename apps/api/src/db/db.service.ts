import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResultRow } from "pg";

export type TenantClient = {
  query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

@Injectable()
export class DbService implements OnModuleDestroy {
  private pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    // BUG-05 / RDS: enable SSL when DATABASE_SSL=true (required for AWS RDS)
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });

  query<T extends QueryResultRow = any>(text: string, params: any[] = []) {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(fn: (db: TenantClient) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const out = await fn({
        query: (text, params = []) => client.query(text, params) as any,
      });
      await client.query("COMMIT");
      return out;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async tenant<T>(
    tenantId: string,
    userId: string | null,
    fn: (db: TenantClient) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (db) => {
      await db.query(
        "SELECT set_config('app.current_tenant_id',$1,true), set_config('app.current_user_id',$2,true)",
        [tenantId, userId || ""],
      );
      return fn(db);
    });
  }

  // BUG-05: ip parameter now captured and stored in audit_logs
  async audit(
    db: TenantClient,
    tenantId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: any = {},
    ip?: string,
  ) {
    await db.query(
      "INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,metadata,ip) VALUES($1,$2,$3,$4,$5,$6,$7::inet)",
      [
        tenantId,
        userId,
        action,
        entityType,
        entityId || null,
        JSON.stringify(metadata),
        ip || null,
      ],
    );
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
