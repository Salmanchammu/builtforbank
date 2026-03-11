/**
 * AI Chatbot Widget for Smart Bank
 * Provides real-time AI assistance to users
 */

class SmartBankChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.apiBaseUrl = window.SMART_BANK_API_BASE || '/api'; // Use global config or fallback
        this.isTyping = false;
        this.isDragging = false;

        this.init();
    }

    init() {
        this.createChatWidget();
        this.attachEventListeners();
        this.loadQuickActions();
    }

    createChatWidget() {
        const widget = document.createElement('div');
        widget.className = 'chat-widget';
        widget.innerHTML = `
            <button class="chat-button" id="chatToggleBtn">
                <i class="fas fa-robot"></i>
            </button>
            
            <div class="chat-window" id="chatWindow">
                <div class="chat-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="chat-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="chat-header-info">
                            <h4>Smart Bank AI</h4>
                            <p>Premium Digital Assistant</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <button class="chat-close-btn" id="chatClearBtn" title="Clear Chat">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button class="chat-close-btn" id="chatCloseBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <i class="fas fa-robot" style="font-size: 40px; color: var(--maroon-deep); margin-bottom: 20px; display: block;"></i>
                        <h3 style="color: var(--maroon-deep); margin-bottom: 8px;">Smart Bank AI</h3>
                        <p style="color: #666; font-size: 13px;">Your personal finance companion. Ask me anything!</p>
                    </div>
                </div>
                
                <div class="chat-quick-actions" id="chatQuickActions"></div>
                
                <div class="chat-input-area">
                    <input type="text" class="chat-input" id="chatInput" placeholder="How can I help you?" autocomplete="off">
                    <button class="chat-send-btn" id="chatSendBtn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        const wrapper = document.querySelector('.mobile-wrapper') || document.body;
        wrapper.appendChild(widget);
    }

    attachEventListeners() {
        const toggleBtn = document.getElementById('chatToggleBtn');
        const closeBtn = document.getElementById('chatCloseBtn');
        const sendBtn = document.getElementById('chatSendBtn');
        const clearBtn = document.getElementById('chatClearBtn');
        const input = document.getElementById('chatInput');
        const widget = toggleBtn.closest('.chat-widget');

        let isDragging = false;
        let startX, startY;
        let initialX, initialY;
        let currentX, currentY;

        // On desktop: make widget position:fixed so it can roam the full viewport
        const isMobile = !!document.querySelector('.mobile-wrapper');
        if (!isMobile) {
            widget.style.position = 'fixed';
            widget.style.bottom = '24px';
            widget.style.right = '24px';
            widget.style.top = 'auto';
            widget.style.left = 'auto';
        } else {
            // Mobile simulation mode
            widget.style.position = 'absolute';
            // Initial positioning is handled by CSS (.mobile-wrapper .chat-widget)
        }
        toggleBtn.style.cursor = 'grab';

        const getWidgetPos = () => {
            const style = window.getComputedStyle(widget);
            const rect = widget.getBoundingClientRect();
            // Prefer left/top if already set, else calculate from right/bottom
            let x = parseFloat(style.left);
            let y = parseFloat(style.top);
            if (isNaN(x) || x === 0 && style.right !== 'auto') {
                x = window.innerWidth - rect.right;
                x = rect.left;
            }
            if (isNaN(y) || y === 0 && style.bottom !== 'auto') {
                y = rect.top;
            }
            return { x, y };
        };

        const dragStart = (e) => {
            if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = e.clientX;
                startY = e.clientY;
            }

            const rect = widget.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            isDragging = true;
            this.isDragging = false;
            toggleBtn.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                this.isDragging = true;
            }

            let newX = initialX + dx;
            let newY = initialY + dy;

            // Boundaries: default to viewport, but if .mobile-wrapper exists, bound to it
            const wrapper = document.querySelector('.mobile-wrapper');
            let minX = 0, minY = 0;
            let maxX = window.innerWidth;
            let maxY = window.innerHeight;

            if (wrapper) {
                const rect = wrapper.getBoundingClientRect();
                minX = rect.left;
                maxX = rect.right;
                minY = rect.top;
                maxY = rect.bottom;
            }

            const btnW = widget.offsetWidth;
            const btnH = widget.offsetHeight;

            // Clamp within boundaries
            newX = Math.max(minX, Math.min(newX, maxX - btnW));
            newY = Math.max(minY, Math.min(newY, maxY - btnH));

            currentX = newX;
            currentY = newY;

            widget.style.right = 'auto';
            widget.style.bottom = 'auto';

            if (wrapper) {
                const rect = wrapper.getBoundingClientRect();
                widget.style.left = `${newX - rect.left}px`;
                widget.style.top = `${newY - rect.top}px`;
            } else {
                widget.style.left = `${newX}px`;
                widget.style.top = `${newY}px`;
            }
        };

        const dragEnd = () => {
            if (!isDragging) return;
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            toggleBtn.style.cursor = 'grab';
        };

        // Touch
        toggleBtn.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);

        // Mouse
        toggleBtn.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        toggleBtn.addEventListener('click', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                e.stopPropagation();
                this.isDragging = false;
                return;
            }
            this.toggleChat();
        });

        closeBtn.addEventListener('click', () => this.closeChat());
        sendBtn.addEventListener('click', () => this.sendMessage());
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearHistory());
        }

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const chatWindow = document.getElementById('chatWindow');
        const toggleBtn = document.getElementById('chatToggleBtn');

        if (this.isOpen) {
            chatWindow.classList.add('active');
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = '<i class="fas fa-times"></i>';

            // Focus input
            setTimeout(() => {
                document.getElementById('chatInput').focus();
            }, 100);
        } else {
            chatWindow.classList.remove('active');
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = '<i class="fas fa-robot"></i>';
        }
    }

    closeChat() {
        this.isOpen = false;
        const chatWindow = document.getElementById('chatWindow');
        const toggleBtn = document.getElementById('chatToggleBtn');

        chatWindow.classList.remove('active');
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fas fa-comments"></i>';
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message || this.isTyping) return;

        // Add user message to chat
        this.addUserMessage(message);
        input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send message to backend
            const response = await fetch(`${this.apiBaseUrl}/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

            if (data.success !== false) {
                // Add bot response
                this.addBotMessage(data.response);

                // Handle special intents
                this.handleIntent(data.intent);
            } else {
                this.addBotMessage("I'm having trouble processing your request. Please try again.");
            }

        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addBotMessage("Sorry, I'm having connection issues. Please try again later.");
        }
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';

        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${this.escapeHtml(message)}
                <span class="message-time">${time}</span>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        this.messages.push({ type: 'user', text: message, time });
    }

    addBotMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';

        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${this.formatMessage(message)}
                <span class="message-time">${time}</span>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        this.messages.push({ type: 'bot', text: message, time });
    }

    showTypingIndicator() {
        this.isTyping = true;
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async loadQuickActions() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat/suggestions`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success && data.suggestions) {
                this.renderQuickActions(data.suggestions);
            }
        } catch (error) {
            console.error('Error loading quick actions:', error);
        }
    }

    renderQuickActions(suggestions) {
        const container = document.getElementById('chatQuickActions');
        container.innerHTML = '';

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'chat-quick-action-btn';
            btn.textContent = suggestion.text;
            btn.onclick = () => this.handleQuickAction(suggestion);
            container.appendChild(btn);
        });
    }

    handleQuickAction(suggestion) {
        const input = document.getElementById('chatInput');
        const actionMessages = {
            'balance': 'Account Balance',
            'transactions': 'Recent Transactions',
            'transfer': 'Transfer Money',
            'loan': 'Loan Information',
            'card': 'Card Information',
            'help': 'Customer Support'
        };
        const message = actionMessages[suggestion.action] || suggestion.text;
        input.value = message;
        this.sendMessage();
    }

    handleIntent(intent) {
        // Handle special intents with navigation
        const intentActions = {
            'balance_inquiry': () => {
                // Focus on balance/accounts
                if (typeof switchTab === 'function') {
                    setTimeout(() => switchTab('home'), 2000);
                }
            },
            'transaction_history': () => {
                if (typeof switchTab === 'function') {
                    setTimeout(() => {
                        this.closeChat();
                        switchTab('transactions');
                    }, 2000);
                }
            },
            'transfer_money': () => {
                if (typeof switchTab === 'function') {
                    setTimeout(() => {
                        this.closeChat();
                        switchTab('transfer');
                    }, 2000);
                }
            },
            'loan_inquiry': () => {
                if (typeof switchTab === 'function') {
                    setTimeout(() => {
                        this.closeChat();
                        switchTab('loans');
                    }, 2000);
                }
            },
            'card_inquiry': () => {
                if (typeof switchTab === 'function') {
                    setTimeout(() => {
                        this.closeChat();
                        switchTab('cards');
                    }, 2000);
                }
            },
            'support_request': () => {
                if (typeof showSupportPage === 'function') {
                    setTimeout(() => {
                        this.closeChat();
                        showSupportPage();
                    }, 2000);
                }
            }
        };

        if (intentActions[intent]) {
            intentActions[intent]();
        }
    }

    formatMessage(message) {
        // Format message with line breaks and basic formatting
        return this.escapeHtml(message).replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }

    clearHistory() {
        this.messages = [];
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-robot"></i>
                <h3>Chat Cleared</h3>
                <p>How can I help you today?</p>
            </div>
        `;
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the page to fully load
    setTimeout(() => {
        window.smartBankChatbot = new SmartBankChatbot();
        console.log('Smart Bank AI Chatbot initialized');
    }, 1000);
});
