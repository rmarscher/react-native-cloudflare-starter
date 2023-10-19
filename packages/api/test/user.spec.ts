import { UserTable } from '../src/db/schema'
import { createMiniflare, createTRPCClient, getDrizzleDb, migrateDb } from './helpers'
import type { Miniflare } from 'miniflare'
import { TRPCClientError } from '@trpc/client'
import { AppRouter } from '../src/router'

describe('User router', () => {
  // in case we have parallelized tests...
  let serverId = 0
  let servers: Miniflare[] = []
  beforeEach(async () => {
    serverId = serverId + 1
    servers[serverId] = createMiniflare()
    await migrateDb({ miniflare: servers[serverId] })
  })
  afterEach(async () => {
    await servers[serverId]?.dispose()
  })
  test('current - error when not authenticated', async () => {
    const miniflare = servers[serverId]
    const client = createTRPCClient({ miniflare })
    let err: TRPCClientError<AppRouter> | null = null
    try {
      const res = await client.user.current.query()
    } catch (e) {
      if (e instanceof TRPCClientError) {
        err = e
      }
    }
    expect(err?.message).toBe('Not authenticated')
  })
  test('current - returns details for authenticated user', async () => {
    const miniflare = servers[serverId]
    const userId = 'test-user'
    const db = await getDrizzleDb({ miniflare })
    await db.insert(UserTable).values({ id: userId, email: 'test@example.com' })

    const client = createTRPCClient({ userId, miniflare })
    const res = await client.user.current.query()
    expect(res?.id).toBe(userId)
  })
})
