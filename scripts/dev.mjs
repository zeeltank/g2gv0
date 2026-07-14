import { startServer } from 'next/dist/server/lib/start-server.js'

function parseArgs(argv) {
  const args = { port: undefined, hostname: undefined }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-p' || arg === '--port') {
      args.port = argv[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--port=')) {
      args.port = arg.slice('--port='.length)
      continue
    }

    if (arg === '-H' || arg === '--hostname') {
      args.hostname = argv[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--hostname=')) {
      args.hostname = arg.slice('--hostname='.length)
    }
  }

  return args
}

const { port, hostname } = parseArgs(process.argv.slice(2))
const dir = process.cwd()

await startServer({
  dir,
  port: Number.parseInt(port || process.env.PORT || '3000', 10),
  isDev: true,
  hostname: hostname || process.env.HOST,
  allowRetry: port == null && process.env.PORT == null,
  serverFastRefresh: true,
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
