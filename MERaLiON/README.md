# MEMENTO Audio Pipeline Architecture

This document outlines the end-to-end audio processing pipeline for the MEMENTO AI Companion. The system is designed with a highly accessible, asynchronous "Tap-to-Talk" UX, specifically optimized for elderly users and dementia patients in Singapore.



## System Flow

The architecture is divided into three distinct phases: Client Capture, Backend Processing, and Client Output.

### Phase 1: Client Audio Capture (Next.js Frontend)
Handles user input using a simplified tap-to-talk interface with automatic silence detection.

* **Trigger:** The user taps the microphone button to start the browser's native `MediaRecorder`.
* **Voice Activity Detection (VAD):** Utilizes `@ricky0123/vad-react` to monitor the audio stream.
* **Auto-Cutoff:** When VAD detects silence for a generous threshold (3-4 seconds, accommodating slower speech patterns), it automatically stops recording.
* **Payload:** The frontend packages the recorded audio chunk into a `.webm` file and sends it to the Next.js backend API.

### Phase 2: Processing (Next.js API & MERaLiON)
Acts as the secure middleman to handle large file uploads and interact with the MERaLiON Audio LLM.

* **Secure Upload:** The API requests a presigned S3 URL (`/upload-url`) and `PUT`s the frontend audio file into the S3 bucket.
* **AI Analysis:** The API triggers MERaLiON (`/analyze` or `/process`) using the uploaded S3 key.
* **Return:** MERaLiON processes the audio and returns a text response. The Next.js API forwards this exact text back to the frontend.

### Phase 3: Text-to-Speech Output (Frontend & Avatar)
Handles the audio synthesis and visual feedback entirely on the client side.

* **Synthesis (Web Speech API):** The frontend receives the text payload and uses the browser's native `window.speechSynthesis` API to read the response aloud (zero backend cost/latency).
* **Visual Sync:** The Avatar component hooks into the Web Speech API's playback events to trigger speaking animations and display subtitles.