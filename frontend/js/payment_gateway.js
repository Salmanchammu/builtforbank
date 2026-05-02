document.addEventListener('DOMContentLoaded', () => {
    const API = '/api';
    
    // Elements
    const cardInput = document.getElementById('cardNumber');
    const expiryInput = document.getElementById('cardExpiry');
    const cvvInput = document.getElementById('cardCvv');
    const pinInput = document.getElementById('cardPin');
    const form = document.getElementById('checkoutForm');
    const payBtn = document.getElementById('payBtn');
    const errorMsg = document.getElementById('errorMsg');
    
    const amountDisplays = [
        document.getElementById('orderAmountItem'),
        document.getElementById('orderAmountTotal'),
        document.getElementById('btnAmount')
    ];
    const merchantDisplay = document.getElementById('merchantName');
    
    // Check URL parameters for dynamic merchant and amount
    const urlParams = new URLSearchParams(window.location.search);
    let amount = parseFloat(urlParams.get('amount')) || 4999.00;
    let merchant = urlParams.get('merchant') || 'Premium Subscription';
    
    // Also extract card if passed (for easy testing from dashboard)
    const passedCard = urlParams.get('card');
    if (passedCard) {
        cardInput.value = formatCardNumber(passedCard);
    }
    
    // Update UI
    amountDisplays.forEach(el => el.textContent = amount.toFixed(2));
    merchantDisplay.textContent = merchant;
    
    // Format Card Number (auto space every 4 digits)
    cardInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        e.target.value = formatCardNumber(val);
    });
    
    function formatCardNumber(val) {
        let parts = [];
        for (let i = 0; i < val.length; i += 4) {
            parts.push(val.substring(i, i + 4));
        }
        return parts.join(' ');
    }
    
    // Format Expiry (MM/YY)
    expiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length >= 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
        }
        e.target.value = val;
    });
    
    // Restrict CVV and PIN to numbers
    cvvInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, ''));
    pinInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, ''));
    
    // Handle form submission (Step 1: Validate & Send OTP)
    let currentUserId = null;
    let paymentPayload = null;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Basic validation
        const cNum = cardInput.value.replace(/\s/g, '');
        if (cNum.length < 13 || cNum.length > 19) return showError('Invalid Card Number length');
        if (expiryInput.value.length !== 5) return showError('Invalid Expiry Date format (MM/YY)');
        if (cvvInput.value.length < 3) return showError('Invalid CVV');
        if (pinInput.value.length !== 4) return showError('PIN must be 4 digits');
        
        errorMsg.style.display = 'none';
        const originalBtnHTML = payBtn.innerHTML;
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Payment...';
        
        try {
            paymentPayload = {
                card_number: cNum,
                expiry_date: expiryInput.value,
                cvv: cvvInput.value,
                pin: pinInput.value,
                amount: amount,
                merchant: merchant
            };
            
            const response = await fetch(`${API}/user/checkout/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentPayload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentUserId = data.user_id;
                document.getElementById('otpEmailDisplay').textContent = data.masked_email;
                document.getElementById('otpBtnAmount').textContent = amount.toFixed(2);
                document.getElementById('otpOverlay').classList.add('active');
                startOtpTimer();
                // Focus first digit
                setTimeout(() => document.querySelector('.otp-digit').focus(), 100);
            } else {
                showError(data.error || 'Payment failed securely');
            }
        } catch (err) {
            console.error(err);
            showError('Network error. Please check your connection.');
        } finally {
            payBtn.disabled = false;
            payBtn.innerHTML = originalBtnHTML;
        }
    });

    // OTP Input Logic
    const otpInputs = document.querySelectorAll('.otp-digit');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    // Timer Logic
    let otpInterval;
    function startOtpTimer() {
        let timeLeft = 60;
        document.getElementById('resendOtpBtn').style.display = 'none';
        document.getElementById('otpTimer').style.display = 'inline';
        clearInterval(otpInterval);
        
        otpInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('otpCountdown').textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(otpInterval);
                document.getElementById('otpTimer').style.display = 'none';
                document.getElementById('resendOtpBtn').style.display = 'inline-block';
            }
        }, 1000);
    }

    document.getElementById('resendOtpBtn').addEventListener('click', async () => {
        // Resend OTP by hitting step 1 again
        form.dispatchEvent(new Event('submit'));
    });

    document.getElementById('otpBackBtn').addEventListener('click', () => {
        document.getElementById('otpOverlay').classList.remove('active');
    });

    // Step 2: Verify & Pay
    document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
        let otpValue = '';
        otpInputs.forEach(input => otpValue += input.value);
        
        const otpError = document.getElementById('otpError');
        otpError.style.display = 'none';

        if (otpValue.length !== 6) {
            otpError.textContent = 'Please enter all 6 digits';
            otpError.style.display = 'block';
            return;
        }

        const btn = document.getElementById('verifyOtpBtn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const verifyPayload = {
                ...paymentPayload,
                otp: otpValue,
                user_id: currentUserId
            };

            const response = await fetch(`${API}/user/checkout/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyPayload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                document.getElementById('otpOverlay').classList.remove('active');
                document.getElementById('txnIdDisplay').textContent = 'Ref: ' + data.transaction_id;
                document.getElementById('successOverlay').classList.add('active');
            } else {
                otpError.textContent = data.error || 'Verification failed';
                otpError.style.display = 'block';
            }
        } catch (err) {
            otpError.textContent = 'Network error during verification';
            otpError.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    });
    
    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }
});
