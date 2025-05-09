import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: call GPT for a single aspect
async function scoreAspectWithGPT({ aspect, flowType, value, context }) {
    const systemPrompt = `You are an AI lead scoring expert. You evaluate individual signals that represent how qualified a real estate lead is.

You will receive:
- aspect: the part of the lead being scored (e.g. Timeline, Budget)
- flowType: buy or sell
- value: the user’s actual answer or behavior
- context: why this aspect matters for lead scoring

Return JSON ONLY in the format:
{
  "score": number from 0–10,
  "explanation": "short, clear sentence explaining why this value received this score"
}
  No extra fluff or explanation. ONLY JSON in the speficified format!.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ aspect, flowType, value, context }) },
    ];

    try {
        const result = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
        });

        const raw = result.choices[0].message.content.trim();
        const clean = raw.replace(/^```json\s*|```$/g, '').trim();
        return JSON.parse(clean);
    } catch (err) {
        console.error(`❌ GPT scoring failed for ${aspect}:`, err);
        return { score: 0, explanation: 'Error occurred during GPT scoring' };
    }
}

// Main scorer function
const scoreLeadWithGPT = async ({ flowType, answers, stepsLog }) => {
    const avgResponseTime =
        stepsLog.reduce((acc, step) => acc + (step.durationMs || 0), 0) /
        stepsLog.length;

    const commonAspects = [
        {
            aspect: 'Response Time',
            value: `${avgResponseTime} ms`,
            flowType,
            context: 'Faster responses indicate higher engagement and interest.',
        },
        {
            aspect: 'Answer Completion Rate',
            value: `${stepsLog.filter((s) => s.answered).length} / ${
                stepsLog.length
            } answered`,
            flowType,
            context:
                'Fully answering all questions shows cooperation and strong interest.',
        },
    ];

    const scoringAspects =
        flowType === 'buy'
            ? [
                  {
                      aspect: 'Timeline',
                      value: answers.timeline || '',
                      flowType,
                      context:
                          'Shorter timelines suggest urgency and stronger intent to transact soon.',
                  },
                  {
                      aspect: 'Budget',
                      value: answers.budget || '',
                      flowType,
                      context:
                          'Higher budgets typically indicate better financial readiness to buy.',
                  },
                  {
                      aspect: 'Financing',
                      value: answers.financing || '',
                      flowType,
                      context:
                          'Cash buyers or pre-approved financing are more likely to close quickly.',
                  },
                  {
                      aspect: 'Motivation',
                      value: answers.motivation || '',
                      flowType,
                      context:
                          'Strong reasons like relocation or investment suggest high intent.',
                  },
                  ...commonAspects,
              ]
            : [
                  {
                      aspect: 'Timeline',
                      value: answers.timeline || '',
                      flowType,
                      context:
                          'Sooner sale timelines typically indicate urgency and readiness to list.',
                  },
                  {
                      aspect: 'Condition',
                      value: answers.condition || '',
                      flowType,
                      context:
                          'Good or excellent condition makes a property easier to sell.',
                  },
                  {
                      aspect: 'Price Expectation',
                      value: answers.priceExpectation || '',
                      flowType,
                      context:
                          'Realistic price expectations increase the likelihood of a quick and successful sale.',
                  },
                  {
                      aspect: 'Mortgage Status',
                      value: answers.mortgageStatus || '',
                      flowType,
                      context:
                          'Properties with no or low mortgage balances tend to close more smoothly.',
                  },
                  {
                      aspect: 'Reason for Selling',
                      value: answers.reasonForSelling || '',
                      flowType,
                      context:
                          'Motivations like relocation or financial necessity suggest serious sellers.',
                  },
                  ...commonAspects,
              ];

    let totalScore = 0;
    const breakdown = {};

    for (const item of scoringAspects) {
        const result = await scoreAspectWithGPT(item);
        breakdown[item.aspect] = result;
        totalScore += result.score;
    }

    const category = totalScore >= 60 ? 'hot' : totalScore >= 40 ? 'warm' : 'cold';

    return {
        score: totalScore,
        category,
        breakdown,
    };
};

export default scoreLeadWithGPT;
