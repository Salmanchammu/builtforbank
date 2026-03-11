window.API = window.SMART_BANK_API_BASE || '/api';
/* ===================================
   FACE AUTHENTICATION - HUMAN ONLY
   Hidden Camera Mode for All Flows (Staff/Admin Login, KYC, Attendance)
   =================================== */

class FaceAuthManager {
    constructor() {
        this.video = null;
        this.stream = null;
        this.modal = null;
        this.faceAPILoaded = false;
        this.currentMode = null;
        this.intendedRole = null;
        this.consecutiveDetections = 0;
        this.REQUIRED_CONSECUTIVE = 3;
        this.kycResolve = null;
        this.kycReject = null;
        this.attendanceType = null;

        this.loadFaceAPIModels().catch(err => console.error('Early model load failed:', err));
    }

    // Dummy init for compatibility
    init() { console.log('FaceAuthManager initialized'); }

    // ─── Load Models ─────────────────────────────────────────────────────────
    async loadFaceAPIModels() {
        if (this.faceAPILoaded) return true;
        try {
            if (typeof faceapi === 'undefined') {
                await Promise.race([
                    this.loadFaceAPIScript(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Face AI Script timeout')), 15000))
                ]);
            }
            const MODEL_URL = '/models';
            await Promise.race([
                Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Models timeout')), 30000))
            ]);
            this.faceAPILoaded = true;
            console.log('✓ Face API models loaded');
            return true;
        } catch (error) {
            console.error('✗ Failed to load Face API models:', error);
            this.faceAPILoaded = false;
            return false;
        }
    }

    loadFaceAPIScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'face-api.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load face-api.js'));
            document.head.appendChild(script);
        });
    }

    // ─── Modal Creation (Hidden Video for All) ───────────────────────────────
    createModal(mode = 'login') {
        this.currentMode = mode;
        this.consecutiveDetections = 0;

        const existingModal = document.getElementById('faceAuthModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'faceAuthModal';
        modal.className = 'face-auth-modal';

        const isKYC = (mode === 'register' || mode === 'kyc');
        const title = isKYC ? 'Face KYC Verification' :
            mode === 'attendance' ? 'Face Attendance' : 'Face Authentication';
        const subtitle = isKYC
            ? 'Capturing face photo for staff review (Camera Hidden)'
            : 'Verifying identity (Camera Hidden)';

        modal.innerHTML = `
            <div class="face-auth-content">
                <div class="face-auth-header">
                    <i class="fas fa-user-shield" style="font-size:40px;color:#667eea;margin-bottom:10px;"></i>
                    <h2 style="margin:0 0 4px;">${title}</h2>
                    <p id="faceSubtitle" style="margin:0;color:#6b7280;font-size:14px;">${subtitle}</p>
                </div>

                <!-- Hidden video for all flows -->
                <video id="faceVideo" autoplay playsinline muted style="position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;"></video>

                <div class="face-status-container" id="faceStatusContainer" style="margin:20px 0;">
                    <div class="face-status-icon" id="statusIcon"><i class="fas fa-circle-notch fa-spin"></i></div>
                    <div class="face-status-text">
                        <strong id="statusTitle">Initializing...</strong>
                        <p id="statusMessage" style="margin:2px 0 0;font-size:13px;">Please wait</p>
                    </div>
                </div>

                <div class="face-instructions" style="margin:16px 0;font-size:13px;background: #f8fafc;border: 1px solid #e2e8f0;border-radius: 8px;padding: 12px;text-align: left;">
                    <ul style="margin:0;padding-left:18px;color:#475569;">
                        <li>Ensure you are in a well-lit area.</li>
                        <li>Face the device directly.</li>
                        <li>Detection will happen automatically.</li>
                    </ul>
                </div>

                <div class="face-progress-bar" style="margin:16px 0;" id="progressBar">
                    <div class="face-progress-fill" id="progressFill"></div>
                </div>

                <div class="face-auth-actions">
                    <button class="btn-face-cancel" onclick="faceAuthManager.closeModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
        setTimeout(() => modal.classList.add('active'), 10);
        return modal;
    }

    // ─── Status Helpers ───────────────────────────────────────────────────────
    updateStatus(type, title, message) {
        const icons = {
            loading: '<i class="fas fa-circle-notch fa-spin"></i>',
            scanning: '<i class="fas fa-camera-viewfinder" style="color:#667eea;animation: scanPulse 1.5s infinite;"></i>',
            success: '<i class="fas fa-check-circle" style="color:#10b981;"></i>',
            error: '<i class="fas fa-times-circle" style="color:#ef4444;"></i>',
            warning: '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i>',
            human: '<i class="fas fa-face-smile" style="color:#10b981;"></i>',
            video: '<i class="fas fa-video" style="color:#ef4444;animation: scanPulse 1s infinite;"></i>'
        };
        const si = document.getElementById('statusIcon');
        const st = document.getElementById('statusTitle');
        const sm = document.getElementById('statusMessage');
        if (si) si.innerHTML = icons[type] || icons.loading;
        if (st) st.textContent = title;
        if (sm) sm.textContent = message;
    }

    updateProgress(pct) {
        const fill = document.getElementById('progressFill');
        if (fill) fill.style.width = pct + '%';
    }

    // ─── Camera ───────────────────────────────────────────────────────────────
    async startCamera() {
        try {
            this.updateStatus('loading', 'Starting Camera...', 'Requesting camera access');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            this.video = document.getElementById('faceVideo');
            if (!this.video) throw new Error('Video element not found');
            this.video.srcObject = this.stream;
            await new Promise(resolve => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
            console.log('✓ Camera started (Hidden)');

            const mode = this.currentMode;
            if (mode === 'register' || mode === 'kyc') {
                await this.detectAndCapture(mode);
            } else if (mode === 'attendance') {
                await this.detectAndSubmitAttendance();
            } else {
                await this.detectAndLogin();
            }
        } catch (error) {
            console.error('Camera error:', error);
            if (error.name === 'NotAllowedError') {
                this.updateStatus('error', 'Camera Denied', 'Please allow camera access in browser settings');
            } else if (error.name === 'NotFoundError') {
                this.updateStatus('error', 'No Camera', 'No camera device detected');
            } else {
                this.updateStatus('error', 'Camera Error', error.message);
            }
            // Auto close after showing error
            setTimeout(() => this.closeModal(), 4000);
            if (this.kycResolve) {
                this.kycResolve(null);
                this.kycResolve = null;
            }
        }
    }

    // ─── Human Landmark Validation ────────────────────────────────────────────
    isRealHumanFace(detection) {
        if (!detection || !detection.landmarks) return false;
        try {
            const p = detection.landmarks.positions;
            // Eyes/Nose/Mouth vertical ordering (Human check)
            const eyesY = (p[36].y + p[39].y + p[42].y + p[45].y) / 4;
            const noseTipY = p[33].y;
            const mouthY = (p[48].y + p[54].y) / 2;
            if (eyesY >= noseTipY || noseTipY >= mouthY) return false;

            // Slightly more lenient on eye-level matching (up to 35% of face height)
            const leftEyeY = (p[36].y + p[39].y) / 2;
            const rightEyeY = (p[42].y + p[45].y) / 2;
            const faceH = detection.detection.box.height;
            if (Math.abs(leftEyeY - rightEyeY) > faceH * 0.35) return false;

            // Aspect ratio check
            const ar = detection.detection.box.width / faceH;
            if (ar < 0.4 || ar > 2.5) return false;
            return true;
        } catch { return false; }
    }

    // ─── Capture Photo Snapshot ───────────────────────────────────────────────
    captureSnapshot() {
        try {
            const canvas = document.createElement('canvas');
            const W = this.video.videoWidth || 320;
            const H = this.video.videoHeight || 240;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');
            // Mirror to match what user sees
            ctx.translate(W, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(this.video, 0, 0, W, H);
            return canvas.toDataURL('image/jpeg', 0.85); // base64 jpeg
        } catch (e) {
            console.warn('Snapshot failed:', e);
            return null;
        }
    }

    // ─── Record 5s KYC Video ──────────────────────────────────────────────────
    async recordKYCVideo() {
        return new Promise((resolve) => {
            try {
                const chunks = [];
                const recorder = new MediaRecorder(this.stream);
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                };

                this.updateStatus('video', 'Recording 5s Video...', 'KYC security check. Please stay centered.');
                recorder.start();
                setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
            } catch (e) {
                console.error('Video recording failed:', e);
                resolve(null);
            }
        });
    }

    // ─── Core Human Detection Loop ────────────────────────────────────────────
    async detectHumanFace() {
        this.consecutiveDetections = 0;
        const startTime = Date.now();
        const timeoutMs = 20000;

        this.updateStatus('scanning', 'Face Detection Active', 'Looking for a human face...');
        this.updateProgress(0);

        return new Promise(resolve => {
            const loop = async () => {
                if (!this.modal || !this.video || !this.video.srcObject) { resolve(null); return; }
                const elapsed = Date.now() - startTime;
                if (!this.faceAPILoaded || elapsed >= timeoutMs) {
                    this.updateStatus('error', 'No Face Detected',
                        elapsed >= timeoutMs ? 'Time limit reached. Please retry.' : 'Face AI not loaded.');
                    setTimeout(() => this.closeModal(), 3000);
                    resolve(null);
                    return;
                }
                this.updateProgress(Math.min((elapsed / timeoutMs) * 100, 95));

                try {
                    const detection = await faceapi
                        .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({
                            inputSize: 320,
                            scoreThreshold: 0.5
                        }))
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (detection && this.isRealHumanFace(detection)) {
                        this.consecutiveDetections++;
                        this.updateStatus('human',
                            `Verifying... ${this.consecutiveDetections}/${this.REQUIRED_CONSECUTIVE}`,
                            'Human face identified. Hold still.');
                        if (this.consecutiveDetections >= this.REQUIRED_CONSECUTIVE) {
                            this.updateProgress(100);
                            resolve(detection);
                            return;
                        }
                    } else {
                        this.consecutiveDetections = 0;
                        if (detection) {
                            this.updateStatus('warning', 'Adjustment Needed', 'Please position your face clearly in front of the camera');
                        } else {
                            this.updateStatus('scanning', 'Scanning...', 'Position your face directly towards the screen');
                        }
                    }
                } catch (e) {
                    console.error('Detection error:', e);
                }
                if (window.requestAnimationFrame) requestAnimationFrame(loop);
                else setTimeout(loop, 200);
            };
            loop();
        });
    }

    // ─── Register / KYC ──────────────────────────────────────────────────────
    async detectAndCapture(mode) {
        const detection = await this.detectHumanFace();
        if (!detection) {
            if (mode === 'kyc' && this.kycResolve) {
                this.kycResolve(null);
                this.kycResolve = null;
            }
            return;
        }

        this.updateStatus('success', 'Face Verified!', mode === 'kyc' ? 'Starting video KYC...' : 'Capturing details...');

        const descriptor = Array.from(detection.descriptor);
        // Photo snapshot if required
        const photo = (mode === 'kyc' || mode === 'register') ? this.captureSnapshot() : null;

        if (mode === 'kyc') {
            const video = await this.recordKYCVideo();
            this.updateStatus('success', 'KYC Captured!', 'Finalizing request...');

            setTimeout(() => {
                const resolve = this.kycResolve;
                this.kycResolve = null; // Mark as handled
                this.closeModal(); // Safe to call now
                if (resolve) resolve({ descriptor, photo, video });
            }, 1000);
        } else {
            await this.registerFace(descriptor);
        }
    }

    async registerFace(descriptor) {
        try {
            this.updateStatus('loading', 'Saving...', 'Registering face authentication');
            const response = await fetch(API + '/face/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ face_descriptor: descriptor })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');
            this.updateStatus('success', 'Registered!', 'Face authentication is now active');
            setTimeout(() => {
                this.closeModal();
                if (typeof showToast === 'function') showToast('Face authentication registered successfully!', 'success');
                if (typeof loadFaceAuthStatus === 'function') loadFaceAuthStatus();
            }, 2000);
        } catch (error) {
            this.updateStatus('error', 'Failed', error.message);
            setTimeout(() => this.closeModal(), 3000);
        }
    }

    // ─── Login ────────────────────────────────────────────────────────────────
    async detectAndLogin() {
        const detection = await this.detectHumanFace();
        if (!detection) return;
        this.updateStatus('loading', 'Verified!', 'Processing login...');
        await this.verifyFace(Array.from(detection.descriptor));
    }

    async verifyFace(descriptor) {
        try {
            let role = this.intendedRole;
            if (!role) {
                role = (window.location.href.includes('admin') || sessionStorage.getItem('userRole') === 'admin')
                    ? 'admin' : 'staff';
            }
            const endpoint = role === 'admin' ? '/admin/face-login' : '/staff/face-login';
            const response = await fetch(`${API}${endpoint}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ face_descriptor: descriptor })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Verification failed');
            this.updateStatus('success', 'Authenticated!', 'Redirecting to your dashboard...');
            sessionStorage.setItem('userRole', data.role);
            sessionStorage.setItem('userName', data.name);
            if (data.role === 'staff' && data.staff) {
                localStorage.setItem('staff', JSON.stringify(data.staff));
                sessionStorage.setItem('userId', data.staff.id);
            } else if (data.role === 'admin' && data.admin) {
                localStorage.setItem('admin', JSON.stringify(data.admin));
                sessionStorage.setItem('userId', data.admin.id);
            }
            setTimeout(() => {
                this.closeModal();
                window.location.href = data.role === 'admin' ? 'admindash.html' : 'staffdash.html';
            }, 1000);
        } catch (error) {
            this.updateStatus('error', 'Auth Failed', error.message);
            setTimeout(() => this.closeModal(), 3000);
        }
    }

    // ─── Attendance ───────────────────────────────────────────────────────────
    async detectAndSubmitAttendance() {
        const detection = await this.detectHumanFace();
        if (!detection) return;
        this.updateStatus('success', 'Verified!', 'Recording your attendance...');
        await this.submitAttendance(Array.from(detection.descriptor));
    }

    async submitAttendance(descriptor) {
        try {
            const endpoint = this.attendanceType === 'clock-in'
                ? '/staff/attendance/clock-in' : '/staff/attendance/clock-out';
            const response = await fetch(API + endpoint, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ face_descriptor: descriptor })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Attendance failed');
            this.updateStatus('success', 'Recorded!', data.message);
            setTimeout(() => {
                this.closeModal();
                if (typeof showToast === 'function') showToast(data.message, 'success');
                if (typeof loadAttendanceStatus === 'function') loadAttendanceStatus();
            }, 2000);
        } catch (error) {
            this.updateStatus('error', 'Failed', error.message);
            setTimeout(() => this.closeModal(), 3000);
        }
    }

    // ─── Close ────────────────────────────────────────────────────────────────
    closeModal() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.kycResolve) {
            this.kycResolve(null);
            this.kycResolve = null;
        }
        if (this.modal) {
            this.modal.classList.remove('active');
            setTimeout(() => { if (this.modal?.parentNode) this.modal.remove(); }, 300);
            this.modal = null;
        }
        this.video = null;
        this.consecutiveDetections = 0;
    }

    // ─── Public Open Methods ──────────────────────────────────────────────────
    async openRegistrationModal() {
        this.createModal('register');
        await Promise.all([this.loadFaceAPIModels(), this.startCamera().catch(console.warn)]);
    }

    async openLoginModal(role = null) {
        this.intendedRole = role;
        this.createModal('login');
        await Promise.all([this.loadFaceAPIModels(), this.startCamera().catch(console.warn)]);
    }

    async captureFaceForKYC() {
        return new Promise(async (resolve, reject) => {
            this.kycResolve = resolve;
            this.kycReject = reject;
            this.createModal('kyc');
            await Promise.all([this.loadFaceAPIModels(), this.startCamera().catch(err => {
                if (this.kycReject) this.kycReject(err);
            })]);
        });
    }

    async captureFaceForAttendance(type = 'clock-in') {
        this.attendanceType = type;
        this.createModal('attendance');
        const title = this.modal.querySelector('h2');
        if (title) title.textContent = type === 'clock-in' ? 'Clock In – Face Verify' : 'Clock Out – Face Verify';
        await Promise.all([this.loadFaceAPIModels(), this.startCamera().catch(console.warn)]);
    }

    async deleteFaceData() {
        if (!confirm('Delete your face authentication data?')) return;
        try {
            const r = await fetch(API + '/face/delete', { method: 'DELETE', credentials: 'include' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed');
            if (typeof showToast === 'function') showToast('Face authentication deleted', 'success');
            if (typeof loadFaceAuthStatus === 'function') loadFaceAuthStatus();
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message, 'error');
        }
    }
}

// ─── Global Instance ──────────────────────────────────────────────────────────
window.faceAuthManager = new FaceAuthManager();

window.addEventListener('beforeunload', () => {
    if (faceAuthManager.stream) faceAuthManager.closeModal();
});

console.log('✓ FaceAuthManager: All Flows Hidden Mode');

// ─── Global Convenience Functions ─────────────────────────────────────────────
window.openFaceRegistration = () => faceAuthManager.openRegistrationModal();
window.testFaceLogin = () => faceAuthManager.openLoginModal();
window.deleteFaceData = async () => faceAuthManager.deleteFaceData();
