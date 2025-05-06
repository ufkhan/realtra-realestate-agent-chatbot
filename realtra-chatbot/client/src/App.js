import ChatbotComponent from './components/ChatbotComponent/ChatbotComponent.jsx';
import chatbotConfigs from './chatbotConfigs.js';
import './App.css';

const clientKey = 'realtra';

const App = () => {
    return (
        <div className="App">
            <ChatbotComponent config={chatbotConfigs[clientKey]} />
        </div>
    );
};

export default App;
