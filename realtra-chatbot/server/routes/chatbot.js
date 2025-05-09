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
    { key: 'bedrooms', question: 'How many bedrooms do you need in your house?' },
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
                "value": "[clean extracted value which is a direct answer to the question: "${currentStep.question}", like 'buy', 'sell', '$500k, 'ASAP', etc. something which accurately but concisely extracts the users answer to question: \"${currentStep.question}\"]"
                }

                However If the user did NOT answer the question: "${currentStep.question}" in their response, seemed confused, or asked for suggestions,
                respond with raw JSON ONLY (No non-JSON stuff, no triple backticks, no formatting), like this:
                {
                "answered": false,
                "reply": "[a short and concise friendly, natural response that helps clarify or gives examples. Keep engaging the user on the same topic, answering their questions or queries. you may have to search google. do it if they ask a question which you dont know answer to! and remember the end goal is helping them and pushing them to answer the question \"${currentStep.question}\"]",
                "value": ""
                }

                "Respond ONLY with raw JSON. Do NOT include any extra text, commentary, greetings, or explanations. Return ONLY a valid JSON object, nothing else. No triple backticks. No formatting. If you're unsure, still return valid JSON with appropriate default values."`,
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

        // Engagement logic trigger (only if stuck on same step for multiple rounds)
        if (
            !parsed.answered &&
            currentStep.key !== 'intent' &&
            session.currentStepMessageCount >= 3
        ) {
            const stepMessages = session.messages.slice(
                -(session.currentStepMessageCount * 2),
            );
            const conversationHistory = stepMessages
                .map((m) => `- ${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`)
                .join('\n');
            console.log('CONVO: ', conversationHistory);
            const engagementCheck = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are a smart assistant helping evaluate real estate leads.
            
            Your task is to determine whether the user is **stuck** answering this question: "${currentStep.question}"
            
            Here is the recent conversation between the user and the bot:
            ${conversationHistory}
            
            - If the user seems engaged — asking follow-up questions or actively trying to understand and reach a decision — respond ONLY with JSON:
            { "isStuck": false }
            
            - If the user is clearly **unable to answer**, repeatedly says they don't know, or is **avoiding the question despite multiple follow-ups**, respond ONLY with JSON:
            { "isStuck": true }
            
            "Respond ONLY with raw JSON. Do NOT include any extra text, commentary, greetings, or explanations. Return ONLY a valid JSON object, nothing else. No triple backticks. No formatting. If you're unsure, still return valid JSON with appropriate default values."
`,
                    },
                ],
            });

            try {
                const rawEngagement = engagementCheck.choices[0].message.content.trim();
                const clean = rawEngagement.replace(/^```json\s*|```$/g, '').trim();
                const engagement = JSON.parse(clean);
                if (engagement.isStuck) {
                    parsed.answered = true;
                    parsed.value = 'not_provided';
                    parsed.reply = 'No worries — we’ll leave that blank and move on.';
                }
            } catch (err) {
                console.error('⚠️ GPT Engagement Check Parse Error:', err);
            }
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

            // Save state as we go
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
