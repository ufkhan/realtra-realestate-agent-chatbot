const ChatbotServicesTraining = [
    { role: 'user', content: "I'd like to get started with your services." },
    { role: 'assistant', content: 'Great! Please provide your name to begin.' },

    { role: 'user', content: 'John' },
    { role: 'assistant', content: 'Thanks, John. Could I get your phone number?' },

    { role: 'user', content: '1234567890' },
    { role: 'assistant', content: 'And lastly, your email address?' },

    { role: 'user', content: 'john.doe@example.com' },
    { role: 'assistant', content: "Thank you, John! We'll be in touch soon." },

    { role: 'user', content: 'What exactly is your platform?' },
    {
        role: 'assistant',
        content:
            'Realtra builds AI-powered lead qualification systems for real estate professionals. Our platform combines smart chatbots, CRM automation, and follow-up systems to help agents convert leads, not just generate them.',
    },

    { role: 'user', content: 'How do your AI chatbots help me as a real estate agent?' },
    {
        role: 'assistant',
        content:
            'Our AI chatbots engage leads instantly, qualify them using smart logic, and collect key details like name, phone, and buying intent—all without human delay.',
    },

    { role: 'user', content: 'Do I still need to follow up manually?' },
    {
        role: 'assistant',
        content:
            'Not anymore. We automate the follow-up with AI messages, CRM workflows, and reminders that keep leads warm until they’re ready to close.',
    },

    { role: 'user', content: 'What if I already have leads from Zillow or MLS?' },
    {
        role: 'assistant',
        content:
            'Perfect. Realtra isn’t about getting you more leads—it’s about converting the ones you already have. We plug into your current lead flow and handle the rest.',
    },

    { role: 'user', content: 'How do you qualify a lead?' },
    {
        role: 'assistant',
        content:
            "We use AI chat to ask intent-based questions like timeframe, financing, and preferred location, so you're only dealing with serious buyers or sellers.",
    },

    { role: 'user', content: 'Can your system send leads to my CRM?' },
    {
        role: 'assistant',
        content:
            'Yes. We integrate with CRMs like HubSpot, FollowUpBoss, and others to push qualified leads directly into your workflow.',
    },

    { role: 'user', content: 'Can I use this on my existing site?' },
    {
        role: 'assistant',
        content:
            'Absolutely. Our chatbot can be embedded into any existing site, landing page, or ad funnel with one line of code.',
    },

    { role: 'user', content: 'What if I don’t have a website?' },
    {
        role: 'assistant',
        content:
            'No problem—we also offer clean, conversion-focused websites built specifically for agents.',
    },

    { role: 'user', content: 'How long does setup take?' },
    {
        role: 'assistant',
        content: 'Typical setup takes 3–5 days. We just need your branding and basic info.',
    },

    { role: 'user', content: 'How much does it cost?' },
    {
        role: 'assistant',
        content:
            'We offer flexible monthly pricing, depending on features. No long-term contracts.',
    },

    { role: 'user', content: 'Can this be used for teams or brokerages?' },
    {
        role: 'assistant',
        content:
            'Yes! We support team-based lead routing, multi-agent workflows, and performance tracking across your agents.',
    },

    { role: 'user', content: 'Is there support if I get stuck?' },
    {
        role: 'assistant',
        content: 'Definitely. Our team provides onboarding and support whenever you need it.',
    },
];

export default ChatbotServicesTraining;
