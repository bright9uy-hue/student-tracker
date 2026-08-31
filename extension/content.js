// WhatsApp Web Auto-Sender Automation
if (window.location.host === 'web.whatsapp.com') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoclick') === 'true') {
        console.log('[WhatsApp Auto-Sender] Auto-send parameter detected.');
        let pasteAttempted = false;
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds max wait
        
        function findSendButton() {
            const btn = document.querySelector('button span[data-icon="send"]') || 
                        document.querySelector('div[role="button"] span[data-icon="send"]') ||
                        document.querySelector('[aria-label="Send"]') || 
                        document.querySelector('[aria-label="إرسال"]') ||
                        document.querySelector('[aria-label="ارسال"]');
            if (btn) return btn;
            
            const candidates = document.querySelectorAll('button, div[role="button"], span[role="button"]');
            for (let b of candidates) {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('send') || label.includes('إرسال') || label.includes('ارسال')) {
                    return b;
                }
                if (b.querySelector('span[data-icon="send"]') || b.querySelector('span[data-icon="send-light"]')) {
                    return b;
                }
            }
            return null;
        }

        const interval = setInterval(() => {
            attempts++;
            
            // Check if we need to paste the image first
            if (params.get('autopaste') === 'true' && !pasteAttempted) {
                const chatInput = document.querySelector('div[contenteditable="true"]') || 
                                  document.querySelector('.copyable-text.selectable-text[contenteditable="true"]');
                if (chatInput) {
                    console.log('[WhatsApp Auto-Sender] Chat input found. Executing native paste...');
                    pasteAttempted = true;
                    
                    chatInput.focus();
                    setTimeout(() => {
                        try {
                            document.execCommand('paste');
                            console.log('[WhatsApp Auto-Sender] Native paste command executed.');
                        } catch (err) {
                            console.error('[WhatsApp Auto-Sender] Native paste failed, falling back to Clipboard API:', err);
                            // Fallback to clipboard API if execCommand is blocked
                            navigator.clipboard.read().then(clipboardItems => {
                                for (const item of clipboardItems) {
                                    for (const type of item.types) {
                                        if (type === 'image/png') {
                                            item.getType(type).then(blob => {
                                                const file = new File([blob], "report.png", { type: "image/png" });
                                                const dataTransfer = new DataTransfer();
                                                dataTransfer.items.add(file);
                                                chatInput.focus();
                                                const pasteEvent = new ClipboardEvent('paste', {
                                                    bubbles: true,
                                                    cancelable: true,
                                                    clipboardData: dataTransfer
                                                });
                                                chatInput.dispatchEvent(pasteEvent);
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    }, 500);
                }
            }
            
            // Look for the send button
            const sendBtn = findSendButton();
            
            if (sendBtn) {
                if (params.get('autopaste') === 'true' && pasteAttempted) {
                    clearInterval(interval);
                    console.log('[WhatsApp Auto-Sender] Send button found. Waiting 2 seconds for preview to stabilize...');
                    setTimeout(() => {
                        const finalSendBtn = findSendButton();
                        if (finalSendBtn) {
                            console.log('[WhatsApp Auto-Sender] Clicking send button...');
                            if (finalSendBtn.tagName === 'SPAN') {
                                const clickable = finalSendBtn.closest('button, div[role="button"], span[role="button"]');
                                if (clickable) {
                                    clickable.click();
                                } else {
                                    finalSendBtn.click();
                                }
                            } else {
                                finalSendBtn.click();
                            }
                        }
                        setTimeout(() => {
                            console.log('[WhatsApp Auto-Sender] Closing tab.');
                            window.close();
                        }, 3000);
                    }, 2000);
                } else if (params.get('autopaste') !== 'true') {
                    // Direct text send
                    clearInterval(interval);
                    console.log('[WhatsApp Auto-Sender] Clicking send button for text...');
                    if (sendBtn.tagName === 'SPAN') {
                        const clickable = sendBtn.closest('button, div[role="button"], span[role="button"]');
                        if (clickable) {
                            clickable.click();
                        } else {
                            sendBtn.click();
                        }
                    } else {
                        sendBtn.click();
                    }
                    setTimeout(() => {
                        console.log('[WhatsApp Auto-Sender] Closing tab.');
                        window.close();
                    }, 3000);
                }
            } else if (attempts >= maxAttempts) {
                console.log('[WhatsApp Auto-Sender] Timeout reached.');
                clearInterval(interval);
            }
        }, 500);
    }
}

// Function to check if a string looks like a student name (Arabic, multiple words, no digits/special chars)
function isStudentName(text) {
    text = text.trim();
    if (text.length < 8 || text.length > 50) return false;
    // Arabic regex
    const arabicPattern = /^[\u0600-\u06FF\s]+$/;
    if (!arabicPattern.test(text)) return false;
    // Must be at least 3 words
    const words = text.split(/\s+/);
    return words.length >= 3;
}

// Function to check status
function parseStatus(text) {
    text = text.trim().toLowerCase();
    const solvedKeywords = ['تم الحل', 'محلول', 'تمت الإجابة', 'تم التسليم', 'مقبول', 'صحيح'];
    const unsolvedKeywords = ['لم يتم الحل', 'غير محلول', 'لم يحل', 'لم يتم التسليم', 'غائب', 'صفر'];

    for (let kw of solvedKeywords) {
        if (text.includes(kw)) return true;
    }
    for (let kw of unsolvedKeywords) {
        if (text.includes(kw)) return false;
    }
    
    // Check for checkmark characters
    if (text.includes('✓') || text.includes('✔') || text.includes('correct') || text.includes('yes')) {
        return true;
    }
    return null; // Undetermined
}

// Main parser function
function extractMadrasatiGrades() {
    const rows = document.querySelectorAll('tr');
    const studentsData = [];
    
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        if (cells.length < 2) return;
        
        let studentName = "";
        let solved = null;
        
        cells.forEach(cell => {
            const text = cell.innerText || cell.textContent || "";
            // Check if this cell is a student name
            if (!studentName && isStudentName(text)) {
                studentName = text.trim().replace(/\s+/g, ' ');
            }
            // Check status in this row
            const parsed = parseStatus(text);
            if (parsed !== null && solved === null) {
                solved = parsed;
            }
        });
        
        // Fallback: search inside spans/icons in the row if solved is still null
        if (studentName && solved === null) {
            const htmlContent = row.innerHTML;
            if (htmlContent.includes('text-success') || htmlContent.includes('fa-check') || htmlContent.includes('fa-circle-check') || htmlContent.includes('تم الحل')) {
                solved = true;
            } else if (htmlContent.includes('text-danger') || htmlContent.includes('fa-xmark') || htmlContent.includes('fa-circle-xmark') || htmlContent.includes('لم يتم الحل')) {
                solved = false;
            } else {
                solved = false; // Default fallback if name is found but no solved status is explicitly true
            }
        }
        
        if (studentName) {
            studentsData.push({
                name: studentName,
                solved: solved !== null ? solved : false
            });
        }
    });
    
    return studentsData;
}

// Inject button if Madrasati page has student table
function injectExtractorButton() {
    // Avoid double injection
    if (document.getElementById('madrasati-extractor-btn')) return;
    
    // Check if we have student lists on page
    const textOnPage = document.body.innerText || "";
    if (!textOnPage.includes('تم الحل') && !textOnPage.includes('الواجبات المرسلة') && !textOnPage.includes('إحصائيات الواجب')) {
        return; // Not an assignment page
    }
    
    // Create a beautiful fixed bar at the top of page
    const bar = document.createElement('div');
    bar.id = 'madrasati-extractor-bar';
    bar.style.position = 'fixed';
    bar.style.top = '10px';
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.background = '#15803d'; // Dark green
    bar.style.color = '#ffffff';
    bar.style.padding = '12px 24px';
    bar.style.borderRadius = '30px';
    bar.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.3)';
    bar.style.zIndex = '999999';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '15px';
    bar.style.fontFamily = "'Tajawal', sans-serif";
    bar.style.fontWeight = 'bold';
    bar.style.direction = 'rtl';
    bar.style.border = '2px solid #ffffff';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = 'نظام رصد الطلاب: تم اكتشاف كشف الواجبات!';
    
    const btn = document.createElement('button');
    btn.id = 'madrasati-extractor-btn';
    btn.textContent = 'استخراج ونسخ الدرجات 📥';
    btn.style.background = '#ffffff';
    btn.style.color = '#15803d';
    btn.style.border = 'none';
    btn.style.padding = '6px 16px';
    btn.style.borderRadius = '20px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '800';
    btn.style.fontSize = '0.9rem';
    btn.style.transition = 'all 0.2s';
    
    btn.onmouseover = () => {
        btn.style.background = '#f0fdf4';
        btn.style.transform = 'scale(1.05)';
    };
    btn.onmouseout = () => {
        btn.style.background = '#ffffff';
        btn.style.transform = 'scale(1)';
    };
    
    btn.onclick = () => {
        const data = extractMadrasatiGrades();
        if (data.length === 0) {
            alert('عذراً، لم نتمكن من قراءة أسماء الطلاب في هذه الصفحة. يرجى فتح صفحة إجابات الطلاب للواجب المرسل.');
            return;
        }
        
        // Write to clipboard as JSON
        const jsonStr = JSON.stringify(data);
        navigator.clipboard.writeText(jsonStr).then(() => {
            // Show custom toast success
            btn.textContent = '✓ تم النسخ بنجاح!';
            btn.style.background = '#25d366'; // WhatsApp green
            btn.style.color = '#ffffff';
            
            setTimeout(() => {
                btn.textContent = 'استخراج ونسخ الدرجات 📥';
                btn.style.background = '#ffffff';
                btn.style.color = '#15803d';
            }, 3000);
            
            alert(`تم استخراج ونسخ درجات (${data.length}) طالباً بنجاح!\n\nانتقل الآن لبرنامج رصد درجات الطلاب، واضغط على زر "استيراد من مدرستي"، ثم الصق الدرجات (Ctrl+V) ليتم رصدها تلقائياً.`);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            alert('حدث خطأ أثناء نسخ البيانات للحافظة. يرجى المحاولة مرة أخرى.');
        });
    };
    
    bar.appendChild(textSpan);
    bar.appendChild(btn);
    document.body.appendChild(bar);
}

// Auto-clicking helper to open the first assignment's student answers page
function autoClickFirstAssignment() {
    const rows = document.querySelectorAll('table tbody tr') || document.querySelectorAll('tr');
    for (let row of rows) {
        const links = row.querySelectorAll('a, button');
        for (let link of links) {
            const text = (link.textContent || link.innerText || '').trim();
            if (text.includes('إجابات') || text.includes('الطلاب') || text.includes('إحصائيات') || text.includes('تفاصيل') || text.includes('استعراض') || text.includes('الواجبات المرسلة')) {
                console.log('[Madrasati Extension] Auto-clicking target link:', text);
                link.click();
                return true;
            }
        }
    }
    return false;
}

// Auto-syncing grades to the background script and Student Tracker tab
let autoSynced = false;
let clickAttempted = false;
function checkAutoSync() {
    if (window.location.host === 'schools.madrasati.sa') {
        const isAutosync = localStorage.getItem('madrasati_autosync') === 'true' || 
                           new URLSearchParams(window.location.search).get('autosync') === 'true';
        
        if (!isAutosync) return;
        
        // Persist the autosync state in localStorage
        localStorage.setItem('madrasati_autosync', 'true');
        
        const data = extractMadrasatiGrades();
        if (data && data.length > 0) {
            if (!autoSynced) {
                autoSynced = true;
                console.log('[Madrasati Extension] Autosync: Student grades found. Sending to tracker...', data.length);
                chrome.runtime.sendMessage({ action: 'gradesScraped', data: data });
                localStorage.removeItem('madrasati_autosync'); // Clear state
                
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'closeActiveTab' });
                }, 2500);
            }
        } else {
            // We are not on the answers page yet. We must be on the assignments list page.
            if (!clickAttempted) {
                clickAttempted = true;
                console.log('[Madrasati Extension] Scraper page not loaded yet. Attempting auto-click...');
                setTimeout(() => {
                    const clicked = autoClickFirstAssignment();
                    if (!clicked) {
                        // Page-level fallback
                        const allLinks = document.querySelectorAll('a, button');
                        for (let link of allLinks) {
                            const text = (link.textContent || link.innerText || '').trim();
                            if (text.includes('إحصائيات الواجب') || text.includes('إجابات الطلاب') || text.includes('الواجبات المرسلة')) {
                                console.log('[Madrasati Extension] Clicking page-level link:', text);
                                link.click();
                                break;
                            }
                        }
                    }
                }, 1500);
            }
        }
    }
}

// Student Tracker listener to receive synced grades
if (window.location.host.includes('127.0.0.1:8000') || window.location.host.includes('localhost:8000')) {
    console.log('[Madrasati Extension] Listener initialized on Student Tracker tab.');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'importAutoGrades') {
            console.log('[Madrasati Extension] Received broadcasted grades:', message.data);
            window.dispatchEvent(new CustomEvent('MadrasatiGradesImported', { detail: message.data }));
        }
    });
}

// Run checks on load and periodically in case of dynamic SPA load
setTimeout(() => {
    injectExtractorButton();
    checkAutoSync();
}, 1500);

setInterval(() => {
    injectExtractorButton();
    checkAutoSync();
}, 3000);
