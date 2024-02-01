import { Hono, type Context, type Next } from 'hono'
import { appRouter } from '@t4/api/src/router'
import { cors } from 'hono/cors'
import { createContext } from '@t4/api/src/context'
import { trpcServer } from '@hono/trpc-server'
import { match } from 'ts-pattern'

export type Bindings = Env & {
  JWT_VERIFICATION_KEY: string
  APP_URL: string
  // For auth
  APPLE_CLIENT_ID: string
  APPLE_TEAM_ID: string
  APPLE_KEY_ID: string
  APPLE_CERTIFICATE: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  RESEND_API_KEY: string
  PUBLIC_SUPPORT_EMAIL: string
  PUBLIC_API_URL: string
  PUBLIC_NATIVE_SCHEME: string
  [k: string]: unknown
}

const app = new Hono<{ Bindings: Bindings }>()

const corsHandler = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  if (c.env.APP_URL === undefined) {
    console.log(
      'APP_URL is not set. CORS errors may occur. Make sure the .dev.vars file is present at /packages/api/.dev.vars'
    )
  }
  return await cors({
    origin: [c.env.APP_URL],
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    // https://hono.dev/middleware/builtin/cors#options
  })(c, next)
}

// Setup CORS for the frontend
app.use('/trpc/*', corsHandler)

// Setup TRPC server with context
app.use('/trpc/*', async (c, next) => {
  return await trpcServer({
    router: appRouter,
    createContext: async ({ resHeaders }) => {
      return await createContext(c.env, c, resHeaders)
    },
    onError: ({ path, error }) => {
      console.error(path, error)
    },
  })(c, next)
})

// https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/#syntax
interface ScheduledEvent {
  cron: string // The value of the Cron Trigger that started the ScheduledEvent
  type: 'scheduled'
  scheduledTime: number // milliseconds since epoch
}

export default {
  ...app,
  async scheduled(event: ScheduledEvent, env: Bindings) {
    const ctx = await createContext(env)
    console.log('Running cron', event.cron)
    await match({ event, ctx })
      .with({ event: { cron: '15 2 0 * *' } }, async ({ ctx }) => {
        await ctx.auth.deleteExpiredSessions()
        console.log('Deleted expired sessions')
      })
      .otherwise(async () => {
        console.log('Unhandled cron event', event)
      })
  },
}
