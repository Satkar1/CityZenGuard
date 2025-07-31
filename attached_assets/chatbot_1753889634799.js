document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Sample legal responses
    const legalResponses = {
        'case status': 'To check your case status, please provide your case number or FIR number.',
        'file fir': 'You can file an FIR at your nearest police station. Would you like assistance in drafting an FIR?',
        'court hearing': 'To check your next hearing date, please provide your case number.',
        'legal advice': 'I can provide general legal information. For specific legal advice, please consult a licensed attorney.',
        'default': 'I understand you need help with a legal matter. Could you please provide more details?'
    };
    
    // Send message function
    function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;
        
        // Add user message
        addMessage(message, 'user');
        userInput.value = '';
        
        // Simulate bot thinking
        setTimeout(() => {
            // Generate bot response
            let response = legalResponses.default;
            const lowerMessage = message.toLowerCase();
            
            for (const [key, value] of Object.entries(legalResponses)) {
                if (lowerMessage.includes(key)) {
                    response = value;
                    break;
                }
            }
            
            addMessage(response, 'bot');
        }, 1000);
    }
    
    // Add message to chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Initial bot message
    addMessage('Hello! I am your AI Legal Assistant. How can I help you today?', 'bot');
});