import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || true,
  methods: ['POST']
}));

// Load API key
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
console.log("GOOGLE_API_KEY loaded?", !!GEMINI_API_KEY); // true/false check

async function callGemini(model, contents) {
  if (!GEMINI_API_KEY) throw new Error("GOOGLE_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = { contents };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const text = await r.text();
    console.error("Gemini API error:", r.status, text);
    throw new Error(`Gemini API failed: ${r.status}`);
  }

  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

// --- Chatbot endpoint ---
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-1.5-flash' } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const reply = await callGemini(model, contents);
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Serve frontend (index.html) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
