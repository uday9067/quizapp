# QuizSync 🎯
A real-time multiplayer quiz app — host live quizzes, players join with a code, compete with a timer.

---

## Project Structure

```
quizapp/
├── client/   → React frontend (deploy to Vercel)
└── server/   → Node.js + Socket.IO backend (deploy to Railway)
```

---

## Local Development

### 1. Start the Server
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:4000
```

### 2. Start the Client
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

The client connects to `http://localhost:4000` by default.

---

## Deploy to Production

### Step 1 — Deploy the Server to Railway (free tier)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo and choose the `server/` folder as the root
4. Railway auto-detects Node.js. Set the start command: `node index.js`
5. After deploy, Railway gives you a URL like `https://quizapp-server.up.railway.app`
6. Copy that URL — you'll need it for the next step

### Step 2 — Deploy the Client to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **New Project → Import your repo**
3. Set **Root Directory** to `client`
4. Under **Environment Variables**, add:
   ```
   VITE_SERVER_URL = https://your-server-url.up.railway.app
   ```
5. Click **Deploy** — Vercel builds and hosts the React app

---

## How It Works

### Host Flow
1. Go to the app → click **Host a Quiz**
2. Add questions (4 options each, mark correct answer)
3. Set timer (10–60s) and leaderboard size (top 10/20/30)
4. Click **Create Room** → get a 6-character room code
5. Share the code with players
6. Watch the player list fill up in the lobby
7. Click **▶ Start Quiz** — quiz begins for everyone simultaneously
8. Watch live scores update as players answer
9. Results appear when all players finish (or click End Quiz)

### Player Flow
1. Go to the app → click **Join a Quiz**
2. Enter the room code + your name → click **Join Room**
3. Wait in the lobby until host starts
4. Answer questions before the timer runs out
5. Faster correct answers = more bonus points (100 base + time bonus)
6. See the leaderboard at the end

### Scoring
- Correct answer: **100 pts + up to ~60 bonus pts** based on speed
- Wrong answer or time expired: **0 pts**
- Tiebreaker: player who finished first ranks higher

---

## Tech Stack
- **Frontend:** React + Vite, CSS Modules, Socket.IO client
- **Backend:** Node.js, Express, Socket.IO
- **Fonts:** Sora + DM Sans (Google Fonts)
