import express from 'express'
import cors from 'cors'
import { deployRouter } from './routes/deploy.js'
import { gitRouter } from './routes/git.js'
import { testRouter } from './routes/test.js'

const app = express()
const PORT = process.env.PORT || 6688

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api', deployRouter)
app.use('/api', gitRouter)
app.use('/api', testRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Deploy Workbench Server running on http://localhost:${PORT}`)
})
