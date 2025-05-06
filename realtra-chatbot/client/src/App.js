import ChatbotComponent from './components/ChatbotComponent/ChatbotComponent.jsx';
import chatbotConfigs from './chatbotConfigs.js';
import './App.css';

const clientKey = 'realtra';

const App = () => {
    return (
        <div className="App">
            <div
                style={{
                    color: 'black',
                    padding: '50px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                }}
            >
                <h1>Realtra Tech Real Estate Agent Bot</h1>
                <p>This is the Realtra active chatbot — qualifying leads</p>
            </div>

            <ChatbotComponent config={chatbotConfigs[clientKey]} />
        </div>
    );
};

export default App;
