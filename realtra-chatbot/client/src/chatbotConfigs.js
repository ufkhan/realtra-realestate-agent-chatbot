const chatbotConfigs = {
    realtra: {
        clientId: 'realtra',
        name: 'Realtra™ Agent X',
        avatar: '/chatbotwelcome.png',
        avatar2: '/chatbotwelcome2.png',
        welcomeMessage: 'Hey there! 👋 Are you looking to buy a new home or sell your current one?',

        theme: {
            toggleBg: '#ffc172', // Chat icon button (closed state) background
            toggleBgActive: '#c69557', // Chat icon button (open state) background
            headerText: '#ffffff', // Header text color (bot name/status)
            botStatus: '#ffc172', // "Online" status color
            userMsgBg: '#273942', // User message bubble background
            userMsgText: '#ffffff', // User message text color
            botMsgBg: '#1d1d1d', // Bot message bubble background
            botMsgText: '#ffffff', // Bot message text color
            formBg: '#000000', // Chat input form background
            inputFocusBorder: '#ffc172', // Input border color on focus
            btnBg: '#ffc172', // Send button background
            btnText: '#273942', // Send button text
            btnHoverBg: '#273942', // Send button hover background
            btnHoverText: '#ffffff', // Send button hover text
            introMsgBg: '#000000', // Intro popup message background
            introMsgBorder: '#ffc172', // Intro popup border color
            introMsgText: '#ffffff', // Intro popup text color
            introMsgArrow: '#000000', // Intro popup arrow color
        },
    },

    eliteHomes: {
        clientId: 'eliteHomes',
        name: 'Elite Homes Bot',
        avatar: '/elite-avatar.png',
        avatar2: '/elite-avatar.png',
        welcomeMessage: 'Hey there! Looking to buy or sell a property? I’m here to help!',

        theme: {
            toggleBg: '#cc3300',
            toggleBgActive: '#a62800',
            headerText: '#ffffff',
            botStatus: '#cc3300',
            userMsgBg: '#44291a',
            userMsgText: '#ffffff',
            botMsgBg: '#1a1a1a',
            botMsgText: '#ffffff',
            formBg: '#000000',
            inputFocusBorder: '#cc3300',
            btnBg: '#cc3300',
            btnText: '#ffffff',
            btnHoverBg: '#ffffff',
            btnHoverText: '#cc3300',
            introMsgBg: '#000000',
            introMsgBorder: '#cc3300',
            introMsgText: '#ffffff',
            introMsgArrow: '#cc3300',
        },
    },
};

export default chatbotConfigs;
