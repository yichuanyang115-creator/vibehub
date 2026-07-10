import { createServer, type Server } from 'http'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname, join, normalize } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

function resolveFilePath(rootDir: string, urlPath: string): string | null {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0])
  const normalizedPath = normalize(join(rootDir, decodedPath))
  if (!normalizedPath.startsWith(normalize(rootDir))) {
    return null
  }

  if (existsSync(normalizedPath) && statSync(normalizedPath).isDirectory()) {
    const indexPath = join(normalizedPath, 'index.html')
    return existsSync(indexPath) ? indexPath : null
  }

  return existsSync(normalizedPath) ? normalizedPath : null
}

export function startStaticServer(rootDir: string, port: number): Server {
  const server = createServer((req, res) => {
    const filePath = resolveFilePath(rootDir, req.url ?? '/')

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404 Not Found')
      return
    }

    const contentType = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    createReadStream(filePath).pipe(res)
  })

  server.listen(port)
  return server
}
