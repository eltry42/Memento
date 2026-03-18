Memento is a Next.js app with voice, avatar, and reminder flows.

## Getting Started

Install dependencies and start the app:

```bash
npm install
cp example.env .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This repo is set up for `npm` and includes a `package-lock.json`, so new contributors should use `npm install` to get the exact dependency tree.

## Requirements

- Node.js 20+
- npm 11+

## Environment

Create `.env.local` from `example.env` and fill in the required API keys before running the app.

## MVP Conversation + Reminder Storage

For quick hackathon testing, this repo now includes a lightweight file-backed database at `data/memento-db.json`.

- `POST /api/process-audio` now stores each user + assistant exchange and auto-extracts reminder candidates.
- `GET /api/conversation?sessionId=<id>` returns saved conversation history.
- `GET /api/reminders?sessionId=<id>` returns extracted reminders.
- `PATCH /api/reminders` with `{ "reminderId": "..." }` marks a reminder as done.

When recording audio from the frontend, include `sessionId` in the `FormData` to group records by user/session.
