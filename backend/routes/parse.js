const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function detectSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('linkedin'))        return 'LinkedIn';
    if (host.includes('indeed'))          return 'Indeed';
    if (host.includes('greenhouse'))      return 'Greenhouse';
    if (host.includes('lever'))           return 'Lever';
    if (host.includes('workday'))         return 'Workday';
    if (host.includes('smartrecruiters')) return 'SmartRecruiters';
    if (host.includes('glassdoor'))       return 'Glassdoor';
    return 'Company Website';
  } catch {
    return '';
  }
}

// POST /api/parse
router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });

  let pageText = '';

  // Fetch the page — best effort, some sites will block
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
    });
    if (response.ok) {
      const html = await response.text();
      pageText = stripHtml(html).slice(0, 8000);
    }
  } catch (err) {
    console.warn('Page fetch failed:', err.message);
  }

  // Ask Claude to extract the fields
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are a job posting parser. Extract structured data from this job posting.

URL: ${url}
${pageText ? `\nPage text:\n${pageText}` : '\n(Page text unavailable — infer from URL only.)'}

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "company": "Company name",
  "role": "Job title",
  "jobId": "Job ID or empty string"
}`
      }],
    });

    const raw = message.content[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/gi, '').trim());

    res.json({
      company: parsed.company || '',
      role:    parsed.role    || '',
      jobId:   parsed.jobId   || '',
      source:  detectSource(url),
    });
  } catch (err) {
    console.error('Parse error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;