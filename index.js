const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;
const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages harus berupa array' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY belum diatur' });
    }

    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Pertemuan 10 API'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter Error:', errorData);
      return res.status(response.status).json({ error: errorData });
    }

    if (!response.body) {
      return res.status(502).json({ error: 'Streaming response tidak tersedia' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const data = trimmedLine.startsWith('data:')
          ? trimmedLine.slice(5).trim()
          : trimmedLine;
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (error) {
          console.error('Gagal parsing streaming data:', error);
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Server Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }

    res.write(`data: ${JSON.stringify({ error: 'Terjadi kesalahan pada server' })}\n\n`);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
