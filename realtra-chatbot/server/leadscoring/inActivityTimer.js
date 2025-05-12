import { connectToDB } from '../dbConnect.js';
import scoreLeadWithGPT from './leadscoring.js';

const sessionTimeouts = {};

const startInactivityTimer = ({ sessionId, session, clientId }) => {
    if (sessionTimeouts[sessionId]) {
        clearTimeout(sessionTimeouts[sessionId]);
    }

    sessionTimeouts[sessionId] = setTimeout(async () => {
        try {
            const db = await connectToDB();
            const lead = await db.collection('leads').findOne({ sessionId });

            if (lead && !lead.completed && lead.flowType) {
                console.log(`⏱️ Auto-scoring inactive session: ${sessionId}`);

                const { leadScore, leadScoreExplanation } = await scoreLeadWithGPT({
                    flowType: lead.flowType,
                    answers: lead.answers,
                    stepsLog: lead.stepsLog,
                    messages: session.messages,
                    clientId,
                    sessionId,
                });

                await db.collection('leads').updateOne(
                    { sessionId },
                    {
                        $set: {
                            leadScore,
                            leadScoreExplanation,
                            completed: false,
                        },
                    },
                );
            }

            delete sessionTimeouts[sessionId];
        } catch (err) {
            console.error(`❌ Inactivity scoring error for ${sessionId}:`, err);
        }
    }, 60 * 1000); // 1 minute
};

export default startInactivityTimer;
