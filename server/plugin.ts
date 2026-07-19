/**
 * server/plugin.ts — mounts the API middleware as a Vite dev-server plugin.
 * The middleware itself (middleware.ts) is Vite-free and can be mounted
 * in any connect-style server.
 */
import type { Connect, Plugin } from 'vite'
import { createMdApiMiddleware, type MdApiDeps } from './middleware'

export function mdApiPlugin(deps: MdApiDeps): Plugin {
  return {
    name: 'novakai-docs-api',
    configureServer(server) {
      const handler = createMdApiMiddleware(deps)
      server.middlewares.use((req: Connect.IncomingMessage, res, next) =>
        handler(req, res, next),
      )
    },
  }
}
