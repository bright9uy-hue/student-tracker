// v2/js/whatsapp.js — the WhatsApp send wrapper. Tries the integrated
// backend engine (server.js, unchanged by this rewrite) first, falls back
// to opening a WhatsApp Web deep link. Ported verbatim from
// js/whatsapp-engine.js's sendWhatsAppDirectOrWeb (the QR-link status
// modal itself is added in Stage 5).
window.sendWhatsAppDirectOrWeb = async function(phone, message, mediaBase64 = null, filename = null) {
    const cleanNum = phone ? phone.toString().replace(/[^0-9]/g, '') : '';
    if (!cleanNum) {
        showNotification('رقم الهاتف غير متوفر أو غير صحيح!', 'error');
        return false;
    }

    let internationalNum = cleanNum;
    if (internationalNum.startsWith('05')) {
        internationalNum = '966' + internationalNum.substring(1);
    } else if (internationalNum.startsWith('5')) {
        internationalNum = '966' + internationalNum;
    }

    try {
        const statusRes = await fetch(getApiUrl('/api/whatsapp/status')).catch(() => null);
        if (statusRes && statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === 'READY') {
                const sendRes = await fetch(getApiUrl('/api/whatsapp/send'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: internationalNum, message, mediaBase64, filename })
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

    showNotification('جاري فتح واتساب ويب للإرسال المباشر...', 'info');
    const encodedMsg = encodeURIComponent(message || '');
    const waWebUrl = `https://web.whatsapp.com/send?phone=${internationalNum}&text=${encodedMsg}`;
    window.open(waWebUrl, '_blank');
    return true;
};
