// whatsapp-engine.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 6068-6198: WHATS-WEB.JS AUTOMATED ENGINE CONTROLLER
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

// ============================================================
// WHATS-WEB.JS AUTOMATED ENGINE CONTROLLER
// ============================================================
window.sendWhatsAppDirectOrWeb = async function(phone, message, mediaBase64 = null, filename = null) {
    const cleanNum = phone ? phone.toString().replace(/[^0-9]/g, '') : '';
    if (!cleanNum) {
        showNotification('رقم الهاتف غير متوفر أو غير صحيح!', 'error');
        return false;
    }

    // Format phone for WhatsApp Web direct URL
    let internationalNum = cleanNum;
    if (internationalNum.startsWith('05')) {
        internationalNum = '966' + internationalNum.substring(1);
    } else if (internationalNum.startsWith('5')) {
        internationalNum = '966' + internationalNum;
    }

    try {
        // 1. Attempt sending via local backend WhatsApp engine on port 8000
        const statusRes = await fetch(getApiUrl('/api/whatsapp/status')).catch(() => null);
        if (statusRes && statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === 'READY') {
                const sendRes = await fetch(getApiUrl('/api/whatsapp/send'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: internationalNum,
                        message: message,
                        mediaBase64: mediaBase64,
                        filename: filename
                    })
                }).catch(() => null);

                if (sendRes && sendRes.ok) {
                    const sendData = await sendRes.json();
                    if (sendData.success) {
                        showNotification('✅ تم إرسال الرسالة عبر محرك واتساب بنجاح!', 'success');
                        return true;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[WhatsApp] Backend engine check failed, falling back to direct web:', e);
    }

    // 2. Smart Seamless Fallback: Direct WhatsApp Web / App URL
    showNotification('جاري فتح واتساب ويب للإرسال المباشر...', 'info');
    const encodedMsg = encodeURIComponent(message || '');
    const waWebUrl = `https://web.whatsapp.com/send?phone=${internationalNum}&text=${encodedMsg}`;
    
    // Open in a new window/tab
    window.open(waWebUrl, '_blank');
    return true;
};

window.openWhatsWebModal = function() {
    const modal = document.getElementById('whatsWebModal');
    if (modal) {
        modal.classList.add('active');
        fetchWhatsWebEngineStatus();
    }
};

window.closeWhatsWebModal = function() {
    const modal = document.getElementById('whatsWebModal');
    if (modal) modal.classList.remove('active');
};

window.fetchWhatsWebEngineStatus = async function() {
    const statusTextEl = document.getElementById('whatsWebStatusText');
    const qrContainer = document.getElementById('whatsWebQrContainer');
    const userDetailsEl = document.getElementById('whatsWebUserDetails');

    if (!statusTextEl || !qrContainer) return;

    statusTextEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري فحص اتصال محرك whats-web.js...';
    qrContainer.innerHTML = '';
    if (userDetailsEl) userDetailsEl.style.display = 'none';

    try {
        const res = await fetch('http://localhost:8000/api/whatsapp/status').catch(() => null);
        if (!res || !res.ok) {
            statusTextEl.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 8px; font-weight: bold; margin-top: 10px;">
                    ⚠️ خادم المحرك غير متصل على البورت 3001! يرجى تشغيل الملف برمجياً:<br>
                    <code style="background:#000; padding:2px 8px; border-radius:4px; margin-top:5px; display:inline-block; color:#fff;">node whats-web.js</code>
                </div>`;
            return;
        }

        const data = await res.json();
        if (data.status === 'READY') {
            statusTextEl.innerHTML = `<span style="color:#10b981; font-weight:800;">✅ المحرك متصل وجاهز للإرسال التلقائي!</span>`;
            if (userDetailsEl && data.user) {
                userDetailsEl.style.display = 'block';
                userDetailsEl.innerHTML = `الحساب المرتبط: <strong>${data.user.name || ''}</strong> (${data.user.phone || ''})`;
            }
        } else if (data.status === 'QR_READY' && data.qr) {
            statusTextEl.innerHTML = `<span style="color:#f59e0b; font-weight:800;">📲 امسح رمز الـ QR أدناه عبر تطبيق الواتساب:</span>`;
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}" alt="WhatsApp QR Code" style="border: 4px solid white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-top: 10px;">`;
        } else if (data.status === 'INITIALIZING') {
            statusTextEl.innerHTML = `<span style="color:#6366f1; font-weight:700;"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري فتح متصفح Chrome وتوليد الـ QR... (سيظهر كود الـ QR هنا تلقائياً خلال ثوانٍ)</span>`;
            const modal = document.getElementById('whatsWebModal');
            if (modal && modal.classList.contains('active')) {
                setTimeout(window.fetchWhatsWebEngineStatus, 2500);
            }
        } else {
            statusTextEl.innerHTML = `<span style="color:#6366f1; font-weight:700;">حالة المحرك: ${data.status}</span>`;
        }
    } catch (err) {
        statusTextEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">حدث خطأ في قراءة حالة المحرك: ${err.message}</span>`;
    }
};

window.logoutWhatsWebEngine = async function() {
    if (!confirm('هل أنت متأكد من تسجيل الخروج وتصفير جلسة محرك الواتساب؟')) return;
    try {
        const res = await fetch('http://localhost:8000/api/whatsapp/logout', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showNotification('تم تسجيل الخروج بنجاح.');
            fetchWhatsWebEngineStatus();
        }
    } catch (err) {
        showNotification('فشل تسجيل الخروج: ' + err.message, 'error');
    }
};

