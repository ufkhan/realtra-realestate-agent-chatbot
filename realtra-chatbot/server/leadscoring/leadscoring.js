import dotenv from 'dotenv';
dotenv.config();

import { connectToDB } from '../dbConnect.js';
import { OpenAI } from 'openai';

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

    // --- Tier 1 Penalty: Form not completed (-30) ---
    if (!lead?.completed) {
        totalScore -= 30;
        tierExplanations.push('Form was not completed. -30 penalty applied.');
    }

    // --- Tier 2: Unprovided Answers Penalty ---
    const unprovidedCount = stepsLog.filter(
        (step) => step.value === 'not_provided',
    ).length;
    const tier2Penalty = unprovidedCount * 7;
    totalScore -= tier2Penalty;
    tierExplanations.push(`${unprovidedCount} unprovided answers. -${tier2Penalty}`);

    // --- Tier 3: Reasonability Checks (20 points) ---
    const tier3Checks = [];
    const weights = flowType === 'buy' ? [1, 3, 1, 2] : [1, 3, 1, 1, 2];

    if (flowType === 'buy') {
        tier3Checks.push(
            {
                check: 'Is location valid for buying?',
                input: answers.location || '',
            },
            {
                check: 'Is the combination of budget, location, property type, and bedroom count realistic?',
                input: `${answers.budget || ''}, ${answers.location || ''}, ${
                    answers.propertyType || ''
                }, ${answers.bedrooms || ''}`,
            },
            {
                check: 'Is timeline reasonable?',
                input: answers.timeline || '',
            },
            {
                check: 'Does the overall buyer profile seem realistic and internally consistent?',
                input: JSON.stringify(answers),
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
        );
    }

    const tier3Prompt = [
        {
            role: 'system',
            content: `You are a lead validation expert. Evaluate each of the following reasonability checks and return a JSON array of objects.

            Each object should include:
            - check (copied as is)
            - input (copied as is)
            - score (0–100)
            - explanation (1–2 line reason why that score)`,
        },
        {
            role: 'user',
            content: JSON.stringify(tier3Checks),
        },
    ];

    try {
        const tier3Result = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: tier3Prompt,
        });

        const cleaned = tier3Result.choices[0].message.content
            .trim()
            .replace(/^```json|```$/g, '');
        const parsed = JSON.parse(cleaned);

        console.log('\n\ud83e\udde0 Tier 3 - Individual Reasonability Scores:');
        parsed.forEach((item, i) => {
            console.log(
                `Check ${i + 1}: "${item.check}"
                Input: ${item.input}
                Score: ${item.score}
                Explanation: ${item.explanation}\n`,
            );
        });

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const weightedScore = parsed.reduce(
            (sum, item, i) => sum + item.score * weights[i],
            0,
        );
        const avgScore = weightedScore / totalWeight;

        const tier3Points = Math.round((avgScore / 100) * 20); // scaled to 20
        totalScore += tier3Points;

        tierExplanations.push(
            `Reasonability weighted score: ${avgScore.toFixed(1)} → +${tier3Points}`,
        );
    } catch (err) {
        console.error('Tier 3 Parse Error:', err);
        tierExplanations.push('Tier 3 scoring failed. +0');
    }

    // --- Tier 4: Lead Temperature Signals (80 points total) ---
    // const qaPairs = stepsLog
    //     .map((step) => `Q: ${step.question}\nA: ${step.value}`)
    //     .join('\n');
    // const tier4Prompt = [
    //     {
    //         role: 'system',
    //         content: `You are a lead temperature evaluator.

    //         You will receive a full set of Q&A pairs. Based on the type of lead (buyer/seller), evaluate the temperature signals using the following rubric:

    //         For BUYERS:
    //         - Timeline: ASAP/soon → +10, "next year" → +3–5
    //         - Budget: GPT determines if high for area → +5–10
    //         - Payment Method: "Cash" → +5, "Financing" → +2–3
    //         - Motivation: "Relocation", "Investment" → +5–7
    //         - Bedrooms: matches family size → +3
    //         - Location: popular/urban areas → +2–5

    //         For SELLERS:
    //         - Timeline: ASAP → +10, "next year" → +3–5
    //         - Price Expectation: realistic? → +5–10
    //         - Condition: Excellent → +5, Average → +2
    //         - Reason for Selling: Financial/Relocation → +5–7
    //         - Mortgage: No/low → +3–5, High → +0–2
    //         - Bedrooms & Type: typical combo → +2–3

    //         Return this JSON structure ONLY:
    //         {
    //         "tone": 0–100,
    //         "detail": 0–100,
    //         "consistency": 0–100,
    //         "leadTempScore": 0–50,
    //         "explanation": "short summary"
    //         }`,
    //     },
    //     {
    //         role: 'user',
    //         content: `Lead type: ${flowType}\n\nQ&A:\n${qaPairs}`,
    //     },
    // ];

    // try {
    //     const tempResult = await openai.chat.completions.create({
    //         model: 'gpt-4o',
    //         messages: tier4Prompt,
    //     });
    //     const clean = tempResult.choices[0].message.content
    //         .trim()
    //         .replace(/^```json|```$/g, '');
    //     const { tone, detail, consistency, leadTempScore, explanation } =
    //         JSON.parse(clean);

    //     const toneScore = Math.round((tone / 100) * 10);
    //     const detailScore = Math.round((detail / 100) * 10);
    //     const consistencyScore = Math.round((consistency / 100) * 10);

    //     totalScore += toneScore + detailScore + consistencyScore + leadTempScore;

    //     tierExplanations.push(
    //         `Tone: +${toneScore}, Detail: +${detailScore}, Consistency: +${consistencyScore}, Temp Signals: +${leadTempScore}. ${explanation}`,
    //     );
    // } catch (err) {
    //     console.error('Tier 4 GPT parse error:', err);
    //     tierExplanations.push('Tier 4 scoring failed. +0');
    // }

    return {
        leadScore: totalScore,
        leadScoreExplanation: tierExplanations.join(' '),
    };
};

export default scoreLeadWithGPT;
