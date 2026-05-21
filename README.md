# Bonne Chance

Bonne Chance is a personal job application tracker built to handle high-volume job searches. Paste a job posting URL and it automatically extracts the company name, role, and job ID using AI. Track where every application stands through a live funnel visualization.
---

## Features

- **URL-powered entry** — paste any job posting URL and the backend fetches the page, strips the HTML, and sends the parsed text to the Anthropic Messages API to extract structured fields (company, role, job ID)
- **Live funnel chart** — visualize your pipeline from applied → submitted → interviewed → offer
- **Status tracking** — update application status inline directly from the table
- **Search and filter** — filter by status, source, or search by company and role
- **Persistent storage** — all data stored locally in SQLite, survives restarts

---

## Tech stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Frontend | HTML, CSS, vanilla JS       |
| Backend  | Node.js + Express           |
| Database | SQLite (via better-sqlite3) |
| AI       | Claude API (Anthropic)      |

---

## Getting started

### Prerequisites
- Node.js v18 or higher
- An API key → [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/Claricex191/bonne-chance.git
cd bonne-chance

# 2. Install dependencies
cd backend && npm install

# 3. Set up environment variables
cp .env.example .env
# Open .env and add your ANTHROPIC_API_KEY

# 4. Start the server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Usage

1. Paste a job posting URL into the input field and click **Fetch**
2. Claude extracts the company, role, and job ID automatically
3. Review the details, select a status, and click **Add to tracker**
4. Update status anytime directly from the table dropdown
5. Watch the funnel chart update in real time

---