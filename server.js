'use strict'

const express = require('express')
const fs      = require('fs')
const path    = require('path')

const app  = express()
const PORT = process.env.PORT || 3017
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

app.listen(PORT, () => { console.log(`MAaS landing page running at http://localhost:${PORT}`) })
