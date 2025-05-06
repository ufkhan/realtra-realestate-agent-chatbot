import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import testRoute from './routes/test.js';
import { default as chatbotRoute } from './routes/chatbot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());

app.use('/api/test', testRoute);

app.use('/api/chatbot', chatbotRoute);

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const PORT = 5051;

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
