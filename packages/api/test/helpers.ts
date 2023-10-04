import * as dotenv from 'dotenv'
dotenv.config({ path: './.dev.vars' })

import { Miniflare } from 'miniflare'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import jwt from '@tsndr/cloudflare-worker-jwt'
import superjson from 'superjson'
import app, { Bindings } from '../src'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { createDb } from '../src/db/client'
import { AppRouter } from '../src/router'

export const JWT_VERIFICATION_KEY = process.env.JWT_VERIFICATION_KEY || '12345'

export const createMiniflare = () => {
  return new Miniflare({
    kvPersist: false,
    d1Persist: false,
    r2Persist: false,
    cachePersist: false,
    durableObjectsPersist: false,
    liveReload: false,
    workers: [
      {
        name: 'api',
        bindings: {
          APP_URL: process.env.APP_URL || 'http://localhost:3000',
          DATABASE_ID: process.env.DATABASE_ID || '12345',
          JWT_VERIFICATION_KEY,
        },
        d1Databases: {
          DB: process.env.DATABASE_ID || '12345',
        },
        modules: true,
        scriptPath: './dist/index.js',
        compatibilityDate: '2023-09-22',
      },
    ],
  })
}

export async function getBindings({ miniflare }: { miniflare: Miniflare }): Promise<Bindings> {
  return await miniflare.getBindings()
}
export async function getDb({ miniflare }: { miniflare: Miniflare }) {
  return await miniflare.getD1Database('DB')
}
export async function getDrizzleDb({ miniflare }: { miniflare: Miniflare }) {
  return createDb(await getDb({ miniflare }))
}
export async function executeSql(sql: string, { miniflare }: { miniflare: Miniflare }) {
  const normalized = sql
    .replaceAll(/--.*/g, '')
    .replaceAll(/[\n\t]/g, '')
    .trim()
  if (!normalized) {
    return undefined
  }
  // console.log(sql)
  const db = await getDb({ miniflare })
  return await db.exec(normalized)
}
export async function migrateDb({ miniflare }: { miniflare: Miniflare }) {
  const files = readMigrationFiles({ migrationsFolder: './migrations' })
  for (let i = 0; i < files.length; i++) {
    const migrationMeta = files[i]
    for (let j = 0; j < migrationMeta.sql.length; j++) {
      await executeSql(migrationMeta.sql[j], { miniflare })
    }
  }
}

/**
 * Creates a session token for the provided user ID. Defaults to 'test-user'
 */
export async function createSessionToken({ userId = 'test-user' }: { userId?: string }) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    sub: userId,
  }
  const algorithm = 'HS256'
  return await jwt.sign(payload, JWT_VERIFICATION_KEY, { algorithm })
}

/**
 * Creates a test TRPC server and client using the bindings from optional
 * provided miniflare instance.
 *
 * If the userId option is provided, it will creates a session token and passes
 * it in the authentication header in the trpc request
 */
export function createTRPCClient({
  miniflare,
  userId,
  url = 'http://localhost:3000/trpc',
}: {
  miniflare: Miniflare
  userId?: string
  url?: string
}) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url,
        async headers() {
          return {
            authorization: userId ? 'Bearer ' + (await createSessionToken({ userId })) : undefined,
          }
        },
        fetch: async (resource, options) =>
          app.fetch(new Request(resource, options), await getBindings({ miniflare })),
      }),
    ],
  })
}
