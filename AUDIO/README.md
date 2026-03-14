# Voice Interaction Pipeline 
This project uses a real-time voice pipeline designed for low-latency, empathetic interaction with elderly users. It integrates @ricky0123/vad-react for client-side processing and MERaLiON LLM & API for transcription and reasoning.

Currently just storing conversation history on client browser side.

## ISSUES / Areas of Improvements todo
- every time user speaks, treated as fresh start
  - use sliding window? summary of convo history? database possible?
  - client vs server side persistence
  - context window
- exponential backoff/buffer for transcription process
- AI boundaries and guardrails + safety (scheduling topics, steering away from certain topics)
- dynamic instruction injection, based on current time/weather etc, depending on user's tone

- i think may have to parse the output of meralion through another llm because output not accurate or smart enough (?)


### AI UI interface
- always display "Listening" as long as after mic button is pressed


### Database to store whole hsitory
- frontend sends only the current audio.
- Backend transcribes it, then looks into the Database to find "previous messages."
- Backend combines the new message + the database messages and talks to MERaLiON.
- Backend saves the new AI reply into the database.