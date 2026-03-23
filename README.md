# AI-Assisted Journal System

A minimalist application that allows users to write journal entries after immersive nature sessions. Features an LLM emotion analysis pipeline with deduplication caching.

## Tech Stack
- **Backend:** Node.js, Express, SQLite, Google Gemini API
- **Frontend:** React (Vite), TailwindCSS, Axios
- **Database:** `sqlite3` driver
- **LLM:** `@google/generative-ai`

## Setup & Running Locally

### Prerequisites
1. Node.js (v18+)
2. Get a Free [Google Gemini API Key](https://aistudio.google.com/)

### 1. Setup Backend
```bash
cd backend
npm install
```
Create a `.env` file inside `backend/`:
```env
GEMINI_API_KEY=your_key_here
PORT=3001
```

Run Backend:
```bash
node index.js
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## Running with Docker (Bonus Feature)

Requires Docker Desktop installed.

1. Ensure `GEMINI_API_KEY` is provided inside `backend/.env`.
2. Run `docker-compose up --build` at the root of `ai-journal-system`.
3. Open `http://localhost:5173` to see the UI. The backend runs on port 3001.

## Architecture & Evaluation Features
Please see `ARCHITECTURE.md` to review the required answers regarding scaling to 100k users, LLM Cost Reduction, Caching mechanisms, and Data Privacy.

### Included Features & Bonuses
- **Caching analysis:** Backend uses a local `llm_cache` SQLite table via a computed string SHA-256 hash. Hitting the same text skips the API and retrieves memory (saving cost and latency).
- **Rate limiting:** Added `express-rate-limit` to the main backend API limiting abusive polling.
- **Docker Setup:** `Dockerfile` inside both clients and standard `docker-compose.yml`.
- **LLM Engine:** Gemini 1.5 Flash API handles accurate json output validation.
