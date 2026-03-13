import { Router, Request, Response } from 'express'
import { GitService } from '../services/git.service.js'

export const gitRouter = Router()
const gitService = new GitService()

interface BranchesRequest {
  repoUrl: string
}

// Get repository branches
gitRouter.post('/branches', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body as BranchesRequest

    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' })
    }

    const branches = await gitService.getBranches(repoUrl)
    res.json({ branches })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get repository info
gitRouter.post('/info', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body as { repoUrl: string }

    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' })
    }

    const info = await gitService.getRepoInfo(repoUrl)
    res.json(info)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Validate repository
gitRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body as { repoUrl: string }

    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' })
    }

    const isValid = await gitService.validateRepo(repoUrl)
    res.json({ valid: isValid })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
