# VoiceScribe

VoiceScribe is a browser-based voice-to-text transcriber that listens to your microphone and converts speech in real time using the Web Speech API. The project now includes an additional Meeting Intelligence layer that can analyze the final transcript and turn it into summary notes, follow-up tasks, deadlines, decisions, and next steps.

## Features

- Start and stop live microphone recording
- Real-time transcription with final and interim text
- Language selection for browser speech recognition
- Live word and character count
- Clear, copy, and download transcript actions
- Meeting Intelligence dashboard with structured analysis
- Export meeting notes as a `.txt` file
- Responsive layout for desktop, tablet, and mobile devices

## Project Structure

```text
VoiceScribe/
├── index.html
├── style.css
├── script.js
├── meetingAnalysis.js
├── server.js
├── package.json
├── .env.example
├── README.md
└── node_modules/
```

## How the app works

1. The browser captures microphone audio through the Web Speech API.
2. Speech recognition produces interim and final transcript text.
3. The final transcript is stored separately from the AI analysis.
4. When the user clicks Analyze Meeting, the frontend sends the transcript to the local backend.
5. The backend either calls an AI provider or falls back to deterministic local analysis.
6. The dashboard displays summary, action items, deadlines, decisions, next steps, and unresolved questions.

## Speech-to-Text flow

The transcription functionality remains in `script.js` and uses `window.SpeechRecognition` / `webkitSpeechRecognition` with:

- `recognition.continuous = true`
- `recognition.interimResults = true`
- dynamic `recognition.lang` updates from the language dropdown
- `finalTranscript` storing the completed speech text
- `interimTranscript` showing the active partial recognition live

## Meeting Intelligence flow

The new Meeting Intelligence layer connects through the local backend at `/api/analyze-meeting`.

- Frontend: `index.html` + `script.js`
- Analysis logic: `meetingAnalysis.js`
- API server: `server.js`

The backend sends the transcript to the configured external AI provider only if `OPENAI_API_KEY` is set. Without a key, it uses a local fallback parser so the UI still functions.

## AI configuration

1. Copy `.env.example` to `.env`.
2. Add your API key:
   ```env
   OPENAI_API_KEY=your_key_here
   OPENAI_MODEL=gpt-4o-mini
   AI_PROVIDER=openai
   PORT=3000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` in your browser.

## Using another device

The Web Speech API requires a secure context for microphone access:

- `http://localhost:3000` works on the computer running the server.
- A phone, tablet, or another computer must use an **HTTPS** URL.
- A plain `http://192.168.x.x:3000` LAN address will usually be blocked by the browser for microphone access.

For local-network testing, the server listens on all network interfaces by default (`HOST=0.0.0.0`). You still need HTTPS, such as a trusted HTTPS tunnel or a local HTTPS reverse proxy. Also allow the port through the computer firewall and grant microphone permission to the browser.

If the app is deployed as a static GitHub Pages site, speech recognition can work over HTTPS, but `/api/analyze-meeting` is not hosted by GitHub Pages. Deploy the Node server separately and configure the frontend API URL before using Meeting Intelligence there.

## Browser compatibility

The Web Speech API works best in:

- Google Chrome
- Microsoft Edge

If the browser does not support speech recognition, the app shows a user-friendly message.

## Privacy note

The transcript is not permanently stored unless the user exports the notes or chooses to save the transcript manually. If an external AI provider is enabled, the transcript is only sent when the user clicks Analyze Meeting.

## Development notes

This project keeps the two systems separate:

- Speech-to-Text is a live browser transcription feature.
- Meeting Intelligence is a separate analysis layer that uses the finished transcript.

The backend is intentionally simple and replaceable so you can later swap providers without rebuilding the frontend logic.
