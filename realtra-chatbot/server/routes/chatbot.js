import express from 'express';
import { OpenAI } from 'openai';
import { connectToDB } from '../dbConnect.js';

const router = express.Router();
const userSessions = {};

const steps = [
    {
        key: 'intent',
        question: 'Are you looking to buy or sell a home?',
        expected: 'buy or sell',
    },
    {
        key: 'location',
        question: 'What location are you interested in?',
        expected: 'a city or neighborhood',
    },
    {
        key: 'propertyType',
        question:
            'What type of property are you looking for? (e.g. single-family, condo, etc.)',
        expected: 'a property type',
    },
];

router.post('/', async (req, res) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const { message, sessionId = 'default', clientId = 'realtra' } = req.body;
        let session = userSessions[sessionId] || {
            messages: [],
            stepIndex: 0,
            answers: {},
        };

        const currentStep = steps[session.stepIndex];
        session.messages.push({ role: 'user', content: message });

        const strictEvaluator = [
            {
                role: 'system',
                content: `You are a real estate lead qualification evaluator.

You will be given a question and a user response. Your job is to return a JSON object that indicates whether the question "${currentStep.question}" was answered — and respond accordingly.

If the user answered the question: "${currentStep.question}" in their response, then respond ONLY with this raw JSON:
{
  "answered": true,
  "reply": "[short friendly confirmation message only]",
  "value": "[clean extracted value, like 'buy', 'sell', etc. something which accurately but concisely extracts the users answer to question: \"${currentStep.question}\"]"
}

However If the user did NOT answer the question: "${currentStep.question}" in their response, seemed confused, or asked for suggestions
respond with raw JSON ONLY (No non-JSON stuff, no triple backticks, no formatting), like this:
{
  "answered": false,
  "reply": "[a short and concise friendly, natural response that helps clarify or gives examples. Keep engaging the user on the same topic, answering their questions or queires with the end goal of helping them answer the question "${currentStep.question}"]",
  "value": ""
}`,
            },
            ...session.messages.slice(-6),
            { role: 'user', content: message },
        ];

        const result = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: strictEvaluator,
        });

        let parsed;
        try {
            const rawReply = result.choices[0].message.content.trim();
            const cleanReply = rawReply.replace(/^```json\s*|```$/g, '').trim();
            parsed = JSON.parse(cleanReply);
        } catch (err) {
            console.error('❌ GPT Parse Fail:', err);
            return res.json({ reply: currentStep.question });
        }

        session.messages.push({ role: 'assistant', content: parsed.reply });

        if (!parsed.answered) {
            userSessions[sessionId] = session;
            return res.json({ reply: parsed.reply });
        }

        // Only reached if answered === true
        session.answers[currentStep.key] = parsed.value;
        session.stepIndex++;

        if (session.stepIndex >= steps.length) {
            const db = await connectToDB();
            await db.collection('leads').insertOne({
                ...session.answers,
                sessionId,
                clientId,
                createdAt: new Date(),
            });
            delete userSessions[sessionId];
            return res.json({
                reply: [
                    parsed.reply,
                    ' ',
                    `Thanks! You're all set. One of our agents will reach out to you soon.`,
                ],
            });
        }

        const nextStep = steps[session.stepIndex];
        const nextQuestion = nextStep.question;
        session.messages.push({ role: 'assistant', content: nextQuestion });
        userSessions[sessionId] = session;

        return res.json({ reply: [parsed.reply, ' ', nextQuestion] });
    } catch (err) {
        console.error('🔥 Step Evaluation Error:', err);
        return res.status(500).json({ error: 'Something went wrong.' });
    }
});

export default router;
