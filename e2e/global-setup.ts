import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { BASE, hermeticViteEnv } from './helpers/env'

let child: ChildProcess | undefined

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isUp()) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`e2e dev server did not start on ${BASE} within ${timeoutMs}ms`)
}

export async function setup(): Promise<void> {
  // Something already answering here (another worktree's server) would be tested instead of this code.
  if (await isUp()) {
    throw new Error(`${BASE} is already in use. Stop that server or run with E2E_PORT=<free port>.`)
  }
  const port = new URL(BASE).port
  child = spawn(resolve(process.cwd(), 'node_modules/.bin/vite'), ['--port', port, '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: hermeticViteEnv()
  })
  await waitForServer()
}

export function teardown(): void {
  if (child && !child.killed) child.kill('SIGTERM')
}
