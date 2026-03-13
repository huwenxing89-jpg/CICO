import { Router, Request, Response } from 'express'
import { SSHService } from '../services/ssh.service.js'

export const testRouter = Router()
const sshService = new SSHService()

interface TestConnectionRequest {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

// Test SSH connection
testRouter.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const config = req.body as TestConnectionRequest

    if (!config.host || !config.username) {
      return res.status(400).json({ error: 'Host and username are required' })
    }

    if (!config.password && !config.privateKey) {
      return res.status(400).json({ error: 'Password or private key is required' })
    }

    const result = await sshService.testConnection(config)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Test server health
testRouter.post('/health-check', async (req: Request, res: Response) => {
  try {
    const { host } = req.body as { host: string }

    if (!host) {
      return res.status(400).json({ error: 'Host is required' })
    }

    const isHealthy = await sshService.healthCheck(host)
    res.json({ healthy: isHealthy })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
