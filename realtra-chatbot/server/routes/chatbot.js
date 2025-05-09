import express from 'express';
import { OpenAI } from 'openai';
import { connectToDB } from '../dbConnect.js';

const router = express.Router();
const userSessions = {};

const defaultStep = {
    key: 'intent',
    question: 'Are you looking to buy or sell a home?',
};

const buyerSteps = [
    {
        key: 'location',
        question: 'What city or neighborhood are you looking to buy in?',
    },
    {
        key: 'propertyType',
        question:
            'What type of property are you looking for? (e.g. single-family, condo, townhouse)',
    },
    { key: 'bedrooms', question: 'How many bedrooms do you need?' },
    {
        key: 'budget',
        question: 'What is your approximate budget range for the purchase?',
    },
    { key: 'timeline', question: 'When are you planning to buy your new home?' },
    { key: 'financing', question: 'Will you be using financing or paying in cash?' },
    {
        key: 'motivation',
        question:
            'What’s your main reason for buying right now? (e.g. relocating, upgrading, investing)',
    },
    { key: 'name', question: 'Can you share your full name?' },
    { key: 'phone', question: 'What’s the best phone number to reach you at?' },
    { key: 'email', question: 'And your email address?' },
];

const sellerSteps = [
    {
        key: 'propertyAddress',
        question: 'What is the address of the property you want to sell?',
    },
    {
        key: 'propertyType',
        question:
            'What type of property is it? (e.g. single-family, condo, townhouse, multi-unit)',
    },
    { key: 'bedrooms', question: 'How many bedrooms does the property have?' },
    {
        key: 'condition',
        question:
            'What is the overall condition of the property? (e.g. excellent, good, needs some work)',
    },
    {
        key: 'reasonForSelling',
        question: 'What’s your reason for selling the property?',
    },
    { key: 'timeline', question: 'When are you hoping to sell?' },
    {
        key: 'priceExpectation',
        question: 'Do you have a price or range in mind for the sale?',
    },
    {
        key: 'mortgageStatus',
        question: 'Is there an existing mortgage on the property?',
    },
    { key: 'name', question: 'Can you share your full name?' },
    { key: 'phone', question: 'What’s the best phone number to reach you at?' },
    { key: 'email', question: 'And your email address?' },
];

router.post('/', async (req, res) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const db = await connectToDB();

    try {
        const { message, sessionId = 'default', clientId = 'realtra' } = req.body;
        let session = userSessions[sessionId] || {
            messages: [],
            stepIndex: 0,
            answers: {},
            steps: [defaultStep],
            stepsLog: [],
            flowType: null,
            currentStepMessageCount: 0, // counts how many user messages per step
        };

        const now = new Date();
        session.currentStepStartTime = session.currentStepStartTime || now;
        session.currentStepMessageCount = (session.currentStepMessageCount || 0) + 1;

        const currentStep = session.steps[session.stepIndex];
        session.messages.push({ role: 'user', content: message, timestamp: now });

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

However If the user did NOT answer the question: "${currentStep.question}" in their response, seemed confused, or asked for suggestions,
respond with raw JSON ONLY (No non-JSON stuff, no triple backticks, no formatting), like this:
{
  "answered": false,
  "reply": "[a short and concise friendly, natural response that helps clarify or gives examples. Keep engaging the user on the same topic, answering their questions or queries with the end goal of helping them answer the question \"${currentStep.question}\"]",
  "value": ""
}

SPECIAL CASE — EMAIL:
If the ${currentStep.question} is about email, and the user says they don't have one or refuses to share, then treat it as answered and respond with this:
{
  "answered": true,
  "reply": "[reply with a 'no problem', and follow up with a friendly confirmation that email is skipped]",
  "value": "not_provided"
}

Do not include extra commentary. Always return raw JSON. No triple backticks. No formatting.`,
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

        const responseTime = new Date();
        const durationMs = responseTime - session.currentStepStartTime;
        const wordCount = message.split(/\s+/).length; // word count of the user message

        session.messages.push({
            role: 'assistant',
            content: parsed.reply,
            timestamp: responseTime,
        });

        session.stepsLog.push({
            stepKey: currentStep.key,
            question: currentStep.question,
            userMessage: message,
            botReply: parsed.reply,
            answered: parsed.answered,
            value: parsed.value,
            startTime: session.currentStepStartTime,
            responseTime,
            durationMs, // total time to answer the step
            messageCount: session.currentStepMessageCount, // total messages it took to answer this step
            wordCount, // word count of final user message
        });

        if (!parsed.answered) {
            session.currentStepStartTime = new Date();
            userSessions[sessionId] = session;

            // Save partial state
            await db.collection('leads').updateOne(
                { sessionId },
                {
                    $set: {
                        sessionId,
                        clientId,
                        createdAt: new Date(),
                        flowType: session.flowType,
                        answers: session.answers,
                        stepsLog: session.stepsLog,
                        completed: false,
                    },
                },
                { upsert: true },
            );

            return res.json({ reply: parsed.reply });
        }

        session.answers[currentStep.key] = parsed.value;
        session.stepIndex++;

        if (currentStep.key === 'intent') {
            const intent = parsed.value.toLowerCase();
            session.steps = intent === 'buy' ? buyerSteps : sellerSteps;
            session.flowType = intent;
            session.stepIndex = 0;
        }

        const isFinalStep = session.stepIndex >= session.steps.length;

        await db.collection('leads').updateOne(
            { sessionId },
            {
                $set: {
                    sessionId,
                    clientId,
                    createdAt: new Date(),
                    flowType: session.flowType,
                    answers: session.answers,
                    stepsLog: session.stepsLog,
                    completed: isFinalStep,
                },
            },
            { upsert: true },
        );

        if (isFinalStep) {
            delete userSessions[sessionId];
            return res.json({
                reply: [
                    parsed.reply,
                    ' ',
                    `Thanks! You're all set. One of our agents will reach out to you soon.`,
                ],
            });
        }

        const nextStep = session.steps[session.stepIndex];
        const nextQuestion = nextStep.question;
        session.messages.push({
            role: 'assistant',
            content: nextQuestion,
            timestamp: new Date(),
        });
        session.currentStepStartTime = new Date();
        session.currentStepMessageCount = 0;
        userSessions[sessionId] = session;

        return res.json({ reply: [parsed.reply, ' ', nextQuestion] });
    } catch (err) {
        console.error('🔥 Step Evaluation Error:', err);
        return res.status(500).json({ error: 'Something went wrong.' });
    }
});

export default router;
