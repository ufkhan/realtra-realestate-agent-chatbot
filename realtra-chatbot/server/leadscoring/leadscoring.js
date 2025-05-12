import dotenv from 'dotenv';
dotenv.config();

import { connectToDB } from '../dbConnect.js';
import { OpenAI } from 'openai';
import chatbotConfigs from '../data/chatbotConfigs.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const scoreLeadWithGPT = async ({
    flowType,
    answers,
    stepsLog,
    messages,
    clientId,
    sessionId,
}) => {
    const db = await connectToDB();
    const lead = await db.collection('leads').findOne({ sessionId });

    let totalScore = 0;
    const tierExplanations = [];

    // --- Tier 1: Form Completion (+30)
    if (lead?.completed) {
        totalScore += 30;
        tierExplanations.push('Form completed. +30 points.');
    } else {
        tierExplanations.push('Form not completed. No +30 applied.');
    }

    // --- Tier 2: Unprovided Answers Penalty (-7 per field)
    const unprovidedCount = stepsLog.filter(
        (step) => step.value === 'not_provided',
    ).length;
    const tier2Penalty = unprovidedCount * 7;
    totalScore -= tier2Penalty;
    tierExplanations.push(
        `${unprovidedCount} unprovided answers. -${tier2Penalty} penalty.`,
    );

    // --- Tier 3: Reasonability (Max 20)
    const tier3Checks = [];
    const weights =
        flowType === 'buy'
            ? [1, 3, 1, 2, 2, 3] // 6 buyer checks
            : [1, 3, 1, 1, 2, 2, 3]; // 7 seller checks

    if (flowType === 'buy') {
        tier3Checks.push(
            { check: 'Is location valid for buying?', input: answers.location || '' },
            {
                check: 'Is the combination of budget, location, property type, and bedroom count realistic and feasible based on typical market conditions? If the combination is generally possible, score high. Only lower the score if it’s clearly unrealistic for this city or property',
                input: `${answers.budget || ''}, ${answers.location || ''}, ${
                    answers.propertyType || ''
                }, ${answers.bedrooms || ''}`,
            },
            { check: 'Is timeline reasonable?', input: answers.timeline || '' },
            {
                check: 'Does the overall buyer profile seem realistic and internally consistent?',
                input: JSON.stringify(answers),
            },
            {
                check: 'Is the full name realistic?',
                input: answers.name || '',
            },
            {
                check: 'Is the phone number realistic and usable?',
                input: answers.phone || '',
            },
        );
    } else {
        tier3Checks.push(
            {
                check: 'Is property address realistic?',
                input: answers.propertyAddress || '',
            },
            {
                check: 'Is price expectation realistic for the location and condition?',
                input: `${answers.priceExpectation || ''}, ${
                    answers.propertyAddress || ''
                }, ${answers.condition || ''}`,
            },
            {
                check: 'Is bedroom count realistic for property type?',
                input: `${answers.bedrooms || ''}, ${answers.propertyType || ''}`,
            },
            {
                check: 'Is timeline for selling reasonable?',
                input: answers.timeline || '',
            },
            {
                check: 'Does the overall seller profile seem realistic and internally consistent?',
                input: JSON.stringify(answers),
            },
            {
                check: 'Is the full name realistic?',
                input: answers.name || '',
            },
            {
                check: 'Is the phone number realistic and usable?',
                input: answers.phone || '',
            },
        );
    }

    try {
        const tier3Prompt = [
            {
                role: 'system',
                content: `You are a lead validation expert. Evaluate each of the following reasonability checks and return a JSON array of objects. Each object must include:
                - check (copied as is)
                - input (copied as is)
                - score (0–100)
                - explanation (1–2 line reason why that score)`,
            },
            { role: 'user', content: JSON.stringify(tier3Checks) },
        ];

        const tier3Result = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: tier3Prompt,
        });

        const raw = tier3Result.choices[0].message.content
            .trim()
            .replace(/^```json|```$/g, '');
        const parsed = JSON.parse(raw);

        console.log('\n🧠 Tier 3 - Individual Reasonability Scores:');
        parsed.forEach((item, i) => {
            console.log(
                `Check ${i + 1}: "${item.check}"
                Input: ${item.input}
                Score: ${item.score}
                Explanation: ${item.explanation}\n`,
            );
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const weightedScore = parsed.reduce(
            (sum, item, i) => sum + item.score * weights[i],
            0,
        );
        const avgScore = weightedScore / totalWeight;
        const tier3Points = Math.round((avgScore / 100) * 20);
        totalScore += tier3Points;

        tierExplanations.push(
            `Reasonability score: ${avgScore.toFixed(1)} → +${tier3Points}`,
        );
    } catch (err) {
        console.error('❌ Tier 3 Parse Error:', err);
        tierExplanations.push('Tier 3 scoring failed. +0');
    }

    // --- Tier 4: Detail + Tone + Temp Factors (Max 50)
    try {
        const qaPairs = stepsLog
            .map((step) => `Q: ${step.question}\nA: ${step.value}`)
            .join('\n');

        const rubric =
            flowType === 'buy'
                ? `BUYER Temp Scoring (max 35):

            - Timeline (max 10):
            • “ASAP”, “immediately”, specific month = 10  
            • “Within 1–3 months” = 8–9  
            • “Within 6 months” = 5–7  
            • “Next year” = 2–4  
            • Vague (e.g. “soon”) = 1–2  
            • No answer = 0

            - Budget (max 9):
            • High for area/property type = 9  
            • Realistic for location = 7–8  
            • Slightly low = 4–6  
            • Unrealistic = 1–3  
            • No answer = 0

            - Payment Method (max 5):
            • “Cash” = 5  
            • “Pre-approved financing” = 4  
            • “Financing” = 3  
            • Unclear or unsure = 1–2  
            • No answer = 0

            - Motivation (max 7):
            • “Relocating”, “Investment”, “Divorce”, “Urgency” = 6–7  
            • “Upgrading”, “Downsizing” = 4–5  
            • “Browsing”, “Testing market” = 2–3  
            • Vague/unsure = 1  
            • No answer = 0

            - Location Demand (max 4):
            • Popular/urban (e.g. LA, NYC, Miami) = 4  
            • Mid-market cities = 2–3  
            • Rural/small towns = 1  
            • Unknown/vague = 0`
                : `SELLER Temp Scoring (max 35):

            - Timeline (max 10):
            • “ASAP”, “immediately”, or specific month = 10  
            • “1–3 months” = 7–9  
            • “6 months” = 5–6  
            • “Next year” = 2–4  
            • Vague = 1  
            • No answer = 0

            - Price Expectation (max 9):
            • Matches comps for condition/location = 9  
            • Slightly above market = 6–8  
            • Overpriced = 3–5  
            • Unrealistic or vague = 1–2  
            • No answer = 0

            - Condition (max 5):
            • “Excellent”, “Renovated” = 5  
            • “Good”, “Clean”, “Updated” = 4  
            • “Okay”, “Average”, “Decent” = 3  
            • “Needs work” = 1–2  
            • “Poor”, “Bad”, or vague = 0

            - Reason for Selling (max 7):
            • “Relocating”, “Financial”, “Divorce”, “Downsizing” = 6–7  
            • “Upgrading”, “Family reasons” = 4–5  
            • Vague (“just want to”, “because I want to”) = 1–2  
            • No answer = 0

            - Mortgage Status (max 4):
            • “No mortgage” = 4  
            • “Low mortgage” = 3  
            • “Average” = 2  
            • “High mortgage” = 1  
            • Unknown = 0`;

        const tier4Prompt = [
            {
                role: 'system',
                content: `You are a lead engagement and temperature evaluator.

                You will receive a full lead Q&A transcript. Use the following rubric based on lead type "${flowType}" for the tempBreakdown scores:

                ${rubric}

                Return this JSON structure ONLY:
                {
                "detail": 0–10,
                "tone": 0–5,
                "tempScore": 0–35,
                "tempBreakdown": {
                    "timeline": X,
                    "budgetOrPrice": X,
                    "paymentOrCondition": X,
                    "motivationOrReason": X,
                    "locationOrMortgage": X
                },
                "explanation": "[Short summary of detail, tone, and each tempBreakdown score and why you scored them that way. Be analytical and structured.]"
                }

                Return only raw JSON. No extra text.`,
            },
            {
                role: 'user',
                content: `Lead type: ${flowType}\n\nQ&A:\n${qaPairs}`,
            },
        ];

        const tempResult = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: tier4Prompt,
        });

        const clean = tempResult.choices[0].message.content
            .trim()
            .replace(/^```json|```$/g, '');

        let parsed;
        try {
            parsed = JSON.parse(clean);
        } catch (err) {
            console.error('❌ Tier 4 JSON Parse Fail:', err);
            tierExplanations.push('Tier 4 returned invalid JSON. +0');
            return;
        }

        const { detail, tone, tempScore, tempBreakdown, explanation } = parsed;

        console.log('\n🔥 Tier 4 - Engagement/Temperature Breakdown:');
        console.log(`Detail: ${detail}`);
        console.log(`Tone: ${tone}`);
        console.log(`Temp Score: ${tempScore}`);
        console.log('Temp Breakdown:', tempBreakdown);
        console.log('Explanation:', explanation);

        totalScore += detail + tone + tempScore;

        tierExplanations.push(
            `Detail: +${detail}, Tone: +${tone}, Temp: +${tempScore}. ${explanation}`,
        );
    } catch (err) {
        console.error('❌ Tier 4 GPT Error:', err);
        tierExplanations.push('Tier 4 scoring failed. +0');
    }

    // --- Tier 5: Client Preferences Match (Max 10)
    try {
        const clientConfig = chatbotConfigs[clientId];
        const preferences = clientConfig?.preferences;

        if (preferences) {
            const prefPrompt = [
                {
                    role: 'system',
                    content: `You are a lead evaluator.

                    You will receive the client's preferences and a full lead Q&A. Score how well the lead matches the preferences (max 10 points). Be objective and logical.

                    Return ONLY raw JSON:
                    {
                    "score": 0–10,
                    "explanation": "[Short reason explaining how well the answers match the preferences]"
                    }`,
                },
                {
                    role: 'user',
                    content: `Client preferences:\n${JSON.stringify(
                        preferences,
                        null,
                        2,
                    )}\n\nLead answers:\n${JSON.stringify(answers, null, 2)}`,
                },
            ];

            const prefResult = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: prefPrompt,
            });

            const raw = prefResult.choices[0].message.content
                .trim()
                .replace(/^```json|```$/g, '');
            const parsed = JSON.parse(raw);

            const { score, explanation } = parsed;
            console.log('\n🎯 Tier 5 - Client Preference Match:');
            console.log(`Score: ${score}`);
            console.log(`Explanation: ${explanation}`);

            totalScore += score;
            tierExplanations.push(
                `Client preferences match: +${score}. ${explanation}`,
            );
        } else {
            tierExplanations.push('No client preferences defined. Tier 5 skipped.');
        }
    } catch (err) {
        console.error('❌ Tier 5 GPT Error:', err);
        tierExplanations.push('Tier 5 scoring failed. +0');
    }

    return {
        leadScore: totalScore,
        leadScoreExplanation: tierExplanations.join(' '),
    };
};

export default scoreLeadWithGPT;
