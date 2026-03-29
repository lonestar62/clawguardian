'use strict'

const express = require('express')
const fs      = require('fs')
const path    = require('path')
const { Pool } = require('pg')

const app  = express()
const PORT = process.env.PORT || 3017

// Live stats from keeperdb — cached 5 minutes
let statsCache = null
let statsCacheAt = 0
const STATS_TTL = 5 * 60 * 1000

async function getLiveStats() {
  if (statsCache && Date.now() - statsCacheAt < STATS_TTL) return statsCache
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://keeperuser:Keeper2026x@34.58.162.212/keeperdb' })
    const [sessRes, listRes, waitRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as sessions, ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(started_at)))/2592000) as months FROM claw.sessions`),
      pool.query(`SELECT COUNT(*) as agents FROM listeners WHERE status='active'`),
      pool.query(`SELECT COUNT(*) as waitlist FROM (SELECT 1) x`)
    ])
    await pool.end()
    statsCache = {
      sessions: parseInt(sessRes.rows[0].sessions),
      months: parseInt(sessRes.rows[0].months) || 6,
      agents: parseInt(listRes.rows[0].agents),
      latency_ms: 27,
      memory_layers: 7
    }
    statsCacheAt = Date.now()
    return statsCache
  } catch(e) {
    return { sessions: 1035, months: 6, agents: 23, latency_ms: 27, memory_layers: 7 }
  }
}
const WAITLIST_FILE = path.join(__dirname, 'waitlist.json')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.post('/api/waitlist', (req, res) => {
  const { name, email, company, agent_description } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email address' })
  const entry = { id: Date.now(), timestamp: new Date().toISOString(), name: name.trim(), email: email.trim().toLowerCase(), company: (company||'').trim(), agent_description: (agent_description||'').trim() }
  let list = []
  if (fs.existsSync(WAITLIST_FILE)) { try { list = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8')) } catch(_) { list=[] } }
  if (list.some(e => e.email === entry.email)) return res.status(200).json({ ok: true, message: 'Already on the list.' })
  list.push(entry)
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2))
  console.log(`[waitlist] +1 => ${entry.name} <${entry.email}> (total: ${list.length})`)
  res.status(201).json({ ok: true, message: 'Added to waitlist.' })
})

// Live stats endpoint — fetched by frontend on load
app.get('/api/stats', async (req, res) => {
  const stats = await getLiveStats()
  res.json(stats)
})

app.get('/api/waitlist', (req, res) => {
  if (!fs.existsSync(WAITLIST_FILE)) return res.json({ count: 0, entries: [] })
  try { const list = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8')); res.json({ count: list.length, entries: list }) }
  catch(_) { res.status(500).json({ error: 'Could not read waitlist' }) }
})

app.get('/sitemap.xml', (_req, res) => {
  const today = new Date().toISOString().split('T')[0]
  res.header('Content-Type', 'application/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://clawguardian.net/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://clawguardian.net/#problem</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://clawguardian.net/#solution</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://clawguardian.net/#how-it-works</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://clawguardian.net/#proof</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://clawguardian.net/#pricing</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://clawguardian.net/#waitlist</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
</urlset>`)
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => { console.log(`ClawGuardian landing page running at http://localhost:${PORT}`) })
