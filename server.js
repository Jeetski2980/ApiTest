import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(morgan('tiny'));
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || true,
  methods: ['POST']
}));

// Gemini proxy
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-1.5-flash' } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] required' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const payload = { contents };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: 'Gemini error', detail: errText });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return res.json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve static frontend
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
