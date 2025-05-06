import express from 'express';
import { OpenAI } from 'openai';
import { connectToDB } from '../dbConnect.js';

import chatbotConfigs from '../data/chatbotConfigs.js';

const router = express.Router();
const userSessions = {};

router.post('/', async (req, res) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const { message, sessionId = 'default', clientId = 'realtra' } = req.body;
        console.log('Incoming message:', message);

        const config = chatbotConfigs[clientId];
        if (!config) {
            return res.status(400).json({ error: 'Invalid clientId' });
        }

        let userSession = userSessions[sessionId] || { messages: [] };
        userSession.messages.push({ role: 'user', content: message });
        const lastMessages = userSession.messages.slice(-3);

        const messages = [
            { role: 'system', content: config.systemPrompt },
            ...config.trainingData,
            ...lastMessages,
        ];

        const openAIResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
        });

        const responseText = openAIResponse.choices[0].message.content;
        console.log('OpenAI Response:', responseText);

        userSession.messages.push({ role: 'assistant', content: responseText });
        userSessions[sessionId] = userSession;

        if (responseText.includes("Let's get you set up! I’ll need a few details.")) {
            userSession.intentConfirmed = true;
            userSessions[sessionId] = userSession;

            return res.json({
                reply: 'Sure! I’ll need a few details. Could you please tell us your name?',
            });
        }

        if (userSession.intentConfirmed) {
            if (!userSession.name) {
                userSession.name = message;
                userSessions[sessionId] = userSession;

                return res.json({
                    reply: `Thanks, ${userSession.name}! Could you please give us the best phone number to reach you at?`,
                });
            }

            if (!userSession.phone) {
                userSession.phone = message;
                userSessions[sessionId] = userSession;

                return res.json({
                    reply: 'Got it! And lastly can you please provide your email address?',
                });
            }

            if (!userSession.email) {
                userSession.email = message;

                const db = await connectToDB();
                await db.collection('leads').insertOne({
                    name: userSession.name,
                    phone: userSession.phone,
                    email: userSession.email,
                    clientId,
                    createdAt: new Date(),
                });

                delete userSessions[sessionId];

                return res.json({
                    reply: `Thank you, ${userSession.name}! We'll be in touch soon! In the meantime, I'm glad to help with any other questions you have!`,
                });
            }
        }

        return res.json({ reply: responseText });
    } catch (err) {
        console.error('Chatbot error:', err);
        return res.status(500).json({ error: 'Something went wrong!' });
    }
});

export default router;
