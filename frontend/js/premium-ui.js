/**
 * Premium UI Notification System
 * Centralized Logic | Global Overrides
 */

(function() {
    'use strict';

// 0. Global Utilities
    window.escHtml = function(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // 1. Create Containers
    function initUI() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    // 2. Toast Implementation
    window.showToast = function(msg, type = 'info', duration = 4000) {
        initUI();
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `premium-toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon-wrap">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${escHtml(msg)}</div>
            </div>
            <button class="toast-close">&times;</button>
            <div class="toast-progress-bar"></div>
        `;

        container.appendChild(toast);

        // Progress Animation
        const bar = toast.querySelector('.toast-progress-bar');
        bar.style.transition = `transform ${duration}ms linear`;
        bar.style.transform = 'scaleX(1)';
        
        // Trigger reflow for animation
        setTimeout(() => {
            bar.style.transform = 'scaleX(0)';
        }, 10);

        const close = () => {
            toast.classList.add('closing');
            setTimeout(() => toast.remove(), 400);
        };

        toast.querySelector('.toast-close').onclick = close;
        const timer = setTimeout(close, duration);

        toast.onmouseenter = () => {
            clearTimeout(timer);
            bar.style.transition = 'none';
        };
    };

    // 3. Modal Base
    function createModal(options) {
        const overlay = document.createElement('div');
        overlay.id = '_confirmModal';
        overlay.className = 'premium-modal-overlay';
        
        const isPrompt = !!options.prompt;
        const isConfirm = !!options.confirm;

        overlay.innerHTML = `
            <div class="premium-modal-box ${isConfirm ? 'modal-confirm' : 'modal-alert'}">
                <div class="modal-icon-header">
                    <i class="fas ${options.icon || (isConfirm ? 'fa-question-circle' : 'fa-info-circle')}"></i>
                </div>
                <div class="modal-title">${escHtml(options.title || 'Notification')}</div>
                <div class="modal-text">${options.messageIsHtml ? options.message : escHtml(options.message || '')}</div>
                ${isPrompt ? `<input type="text" class="modal-input" placeholder="${escHtml(options.placeholder || '')}" value="${escHtml(options.defaultValue || '')}">` : ''}
                <div class="modal-actions">
                    ${isConfirm || isPrompt ? `<button class="modal-btn modal-btn-cancel">${escHtml(options.cancelText || 'Cancel')}</button>` : ''}
                    <button class="modal-btn modal-btn-confirm">${escHtml(options.confirmText || 'OK')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('.modal-input');
        if (input) setTimeout(() => input.focus(), 300);

        return new Promise((resolve) => {
            const cleanup = (val) => {
                overlay.style.opacity = '0';
                overlay.querySelector('.premium-modal-box').style.transform = 'scale(0.9)';
                setTimeout(() => {
                    overlay.remove();
                    resolve(val);
                }, 300);
            };

            overlay.querySelector('.modal-btn-confirm').onclick = () => {
                cleanup(isPrompt ? input.value : true);
            };

            const cancelBtn = overlay.querySelector('.modal-btn-cancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => cleanup(isPrompt ? null : false);
            }

            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup(isPrompt ? null : false);
            };
        });
    }

    // 4. Native Overrides
    window.alert = function(msg) {
        return createModal({ 
            message: msg, 
            icon: 'fa-info-circle', 
            title: 'Message',
            confirmText: 'Got it'
        });
    };

    window.confirm = async function(msg) {
        console.warn('Native confirm() is now async via Premium UI. Ensure you await its result.');
        return createModal({ 
            message: msg, 
            icon: 'fa-question-circle', 
            title: 'Please Confirm',
            confirmText: 'Yes, Proceed',
            cancelText: 'No, Cancel',
            confirm: true
        });
    };

    window.prompt = async function(msg, def) {
        console.warn('Native prompt() is now async via Premium UI. Ensure you await its result.');
        return createModal({ 
            message: msg, 
            icon: 'fa-edit', 
            title: 'Input Required',
            confirmText: 'Submit',
            cancelText: 'Cancel',
            prompt: true,
            defaultValue: def
        });
    };

    // Shared showConfirm for dashboard compatibility
    window.showConfirm = function({ title, message, warning, icon, confirmText, onConfirm, messageIsHtml }) {
        return createModal({
            title: title || 'Confirmation',
            message: warning ? `<strong style="color:#ef4444;display:block;margin-bottom:8px;">${escHtml(warning)}</strong>${messageIsHtml ? message : escHtml(message)}` : (messageIsHtml ? message : escHtml(message)),
            icon: icon || 'fa-exclamation-triangle',
            confirmText: confirmText || 'Confirm',
            confirm: true,
            messageIsHtml: messageIsHtml || !!warning
        }).then(res => {
            if (res && onConfirm) onConfirm();
            return res;
        });
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
