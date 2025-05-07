import { useState, useEffect, useRef } from 'react';
import './ChatbotComponent.scss';
import { FiX } from 'react-icons/fi';

const ChatbotComponent = ({ config }) => {
    const [message, setMessage] = useState('');
    const [response, setResponse] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [welcomeShown, setWelcomeShown] = useState(false);
    const messagesEndRef = useRef(null);
    const sessionId = useRef(Date.now() + '-' + Math.floor(Math.random() * 100000));

    const themeVars = config.theme
        ? {
              '--toggle-bg': config.theme.toggleBg,
              '--toggle-bg-active': config.theme.toggleBgActive,
              '--header-text': config.theme.headerText,
              '--bot-status': config.theme.botStatus,
              '--user-msg-bg': config.theme.userMsgBg,
              '--user-msg-text': config.theme.userMsgText,
              '--bot-msg-bg': config.theme.botMsgBg,
              '--bot-msg-text': config.theme.botMsgText,
              '--form-bg': config.theme.formBg,
              '--input-focus-border': config.theme.inputFocusBorder,
              '--btn-bg': config.theme.btnBg,
              '--btn-text': config.theme.btnText,
              '--btn-hover-bg': config.theme.btnHoverBg,
              '--btn-hover-text': config.theme.btnHoverText,
              '--intro-msg-bg': config.theme.introMsgBg,
              '--intro-msg-border': config.theme.introMsgBorder,
              '--intro-msg-text': config.theme.introMsgText,
              '--intro-msg-arrow': config.theme.introMsgArrow,
          }
        : {};

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsOpen(true);
            if (!welcomeShown) {
                setResponse((prev) => [...prev, { bot: config.welcomeMessage }]);
                setWelcomeShown(true);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message) return;

        setResponse((prev) => [...prev, { user: message }]);
        setMessage('');
        setLoading(true);
        setResponse((prev) => [...prev, { bot: `${config.name} is typing...` }]);

        try {
            const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/chatbot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId: sessionId.current,
                    clientId: config.clientId,
                }),
            });

            const data = await res.json();
            setResponse((prev) => prev.filter((res) => res.bot !== `${config.name} is typing...`));
            setResponse((prev) => [...prev, { bot: data.reply || 'Sorry, something went wrong.' }]);
        } catch (err) {
            console.error('Error:', err);
            setResponse((prev) => [...prev, { bot: 'An error occurred. Please try again.' }]);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [response]);

    const handleChatbotToggle = () => {
        if (!isOpen && !welcomeShown) {
            setResponse((prev) => [...prev, { bot: config.welcomeMessage }]);
            setWelcomeShown(true);
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            {isOpen && <div className="chatbot-overlay" onClick={() => setIsOpen(false)} />}
            <div className="chatbot-wrapper" style={themeVars}>
                <div
                    className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
                    onClick={handleChatbotToggle}
                >
                    {isOpen ? (
                        <FiX size={24} color="#ffffff" />
                    ) : (
                        <img
                            src={config.avatar}
                            alt="chatbot logo"
                            height={85}
                            width={76}
                            className="chatbot-toggle-icon"
                        />
                    )}
                </div>

                {isOpen && (
                    <div className="chatbot-container">
                        <div className="chatbot-header">
                            <div className="chatbot-header-content">
                                <img
                                    src={config.avatar2}
                                    alt="bot avatar"
                                    height={85}
                                    width={76}
                                    className="bot-avatar"
                                />
                                <div className="bot-info">
                                    <h3 className="bot-name">{config.name}</h3>
                                    <span className="bot-status">Online</span>
                                </div>
                            </div>
                            <div className="mobile-close-btn" onClick={() => setIsOpen(false)}>
                                <FiX size={24} color="#ffffff" />
                            </div>
                        </div>

                        <div className="chatbot-messages">
                            {response.map((res, index) => (
                                <div key={index} className="message">
                                    {res.user && <p className="user-message">{res.user}</p>}
                                    {res.bot && (
                                        <div className="bot-message-container">
                                            <img
                                                src={config.avatar2}
                                                alt="bot avatar"
                                                height={85}
                                                width={76}
                                                className="bot-avatar-small"
                                            />
                                            <p
                                                className={`bot-message ${
                                                    res.bot === `${config.name} is typing...`
                                                        ? 'typing-indicator'
                                                        : ''
                                                }`}
                                            >
                                                {res.bot}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSubmit} className="chatbot-form">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Message..."
                            />
                            <button type="submit" disabled={loading}>
                                Send
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
};

export default ChatbotComponent;
