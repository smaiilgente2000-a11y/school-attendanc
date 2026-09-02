// ================ تهيئة النظام ================
let students = JSON.parse(localStorage.getItem('students')) || [];
let attendance = JSON.parse(localStorage.getItem('attendance')) || {};
let today = new Date().toISOString().split('T')[0];
let lastScanTime = 0;
let scanTimeout;

// ================ متغيرات الكاميرا ================
let html5QrCode = null;
let isCameraScanning = false;

// ================ تحديث التاريخ ================
function updateDateDisplay() {
    const dateElement = document.getElementById('currentDate');
    const todayDate = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = todayDate.toLocaleDateString('ar-MA', options);
}

// ================ التبديل بين التبويبات ================
function switchTab(tabName) {
    if (tabName !== 'scan' && isCameraScanning) {
        stopCamera();
    }

    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName + '-tab').classList.add('active');

    const activeButton = Array.from(buttons).find(btn =>
        btn.textContent.includes(getTabTitle(tabName))
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }

    if (tabName === 'scan') {
        document.getElementById('scanInput').focus();
    }
}

function getTabTitle(tabName) {
    const titles = {
        'scan': 'مسح',
        'students': 'إدارة',
        'barcodes': 'باركود'
    };
    return titles[tabName] || tabName;
}

// ================ معالجة المسح من جهاز المسح الخارجي ================
document.addEventListener('DOMContentLoaded', function() {
    const scanInput = document.getElementById('scanInput');
    scanInput.focus();

    scanInput.addEventListener('input', function(e) {
        const code = this.value.trim();
        if (code.length >= 3) {
            clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => {
                processScan(code);
                this.value = '';
                this.focus();
            }, 100);
        }
    });

    scanInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = this.value.trim();
            if (code) {
                processScan(code);
                this.value = '';
            }
        }
    });

    scanInput.addEventListener('blur', function() {
        setTimeout(() => {
            if (document.getElementById('scan-tab').classList.contains('active')) {
                this.focus();
            }
        }, 10);
    });
});

// ================ معالجة المسح (عامة) ================
function processScan(code) {
    const now = Date.now();
    if (now - lastScanTime < 1000) {
        return;
    }
    lastScanTime = now;

    const student = students.find(s => s.code === code);
    if (!student) {
        showMessage('❌ رمز غير معروف: ' + code, 'error');
        playBeep('error');
        return;
    }

    if (attendance[today]?.includes(student.id)) {
        showMessage('⚠️ ' + student.name + ' مسجل بالفعل', 'warning');
        playBeep('warning');
        return;
    }

    if (!attendance[today]) {
        attendance[today] = [];
    }
    attendance[today].push(student.id);
    saveData();

    showMessage('✅ تم تسجيل حضور: ' + student.name + ' (' + student.code + ')', 'success');
    playBeep('success');
    updateDisplay();
}

// ================ دوال الكاميرا ================
function toggleCamera() {
    if (isCameraScanning) {
        stopCamera();
    } else {
        startCamera();
    }
}

function startCamera() {
    if (typeof Html5Qrcode === 'undefined') {
        showMessage('❌ مكتبة المسح غير محملة. تأكد من اتصال الإنترنت.', 'error');
        return;
    }

    const container = document.getElementById('cameraContainer');
    container.style.display = 'block';
    const readerDiv = document.getElementById('reader');
    readerDiv.innerHTML = '';

    try {
        html5QrCode = new Html5Qrcode("reader");
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.PDF_417
            ]
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        ).then(() => {
            isCameraScanning = true;
            document.getElementById('cameraBtn').textContent = '⏹️ إيقاف الكاميرا';
            showMessage('📷 الكاميرا تعمل ...', 'success');
        }).catch(err => {
            console.error('خطأ في تشغيل الكاميرا:', err);
            showMessage('❌ تعذر تشغيل الكاميرا: ' + err.message, 'error');
            container.style.display = 'none';
            isCameraScanning = false;
        });
    } catch (e) {
        showMessage('❌ خطأ في تهيئة الكاميرا: ' + e.message, 'error');
        container.style.display = 'none';
        isCameraScanning = false;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    stopCamera();
    document.getElementById('scanInput').value = decodedText;
    processScan(decodedText);
}

function onScanError(err) { }

function stopCamera() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            isCameraScanning = false;
            document.getElementById('cameraContainer').style.display = 'none';
            document.getElementById('cameraBtn').textContent = '📷 مسح بالكاميرا';
            showMessage('⏹️ تم إيقاف الكاميرا', 'warning');
        }).catch(err => {
            console.error('خطأ في إيقاف الكاميرا:', err);
        });
    } else {
        document.getElementById('cameraContainer').style.display = 'none';
        document.getElementById('cameraBtn').textContent = '📷 مسح بالكاميرا';
        isCameraScanning = false;
    }
}

// ================ عرض الرسائل ================
function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = 'message-box';

    if (type) {
        messageBox.classList.add('message-' + type);
    }

    clearTimeout(messageBox.timeout);
    messageBox.timeout = setTimeout(() => {
        messageBox.className = 'message-box';
    }, 4000);
}

// ================ أصوات التنبيه ================
function playBeep(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        switch (type) {
            case 'success':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.3;
                oscillator.start();
                setTimeout(() => {
                    oscillator.frequency.value = 1000;
                }, 100);
                setTimeout(() => {
                    oscillator.stop();
                }, 300);
                break;

            case 'error':
                oscillator.frequency.value = 200;
                gainNode.gain.value = 0.3;
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 500);
                break;

            case 'warning':
                oscillator.frequency.value = 600;
                gainNode.gain.value = 0.2;
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 200);
                break;
        }
    } catch (e) {
        console.log('تعذر تشغيل الصوت');
    }
}

// ================ إدارة التلاميذ ================
function addStudent() {
    const name = document.getElementById('studentName').value.trim();
    const level = document.getElementById('studentLevel').value.trim();
    const code = document.getElementById('studentCode').value.trim();

    if (!name || !code) {
        showMessage('❌ يرجى إدخال الاسم والرمز التعريفي', 'error');
        return;
    }

    if (students.some(s => s.code === code)) {
        showMessage('❌ هذا الرمز التعريفي موجود بالفعل', 'error');
        return;
    }

    const newStudent = {
        id: Date.now(),
        name: name,
        level: level || 'غير محدد',
        code: code,
        createdAt: new Date().toISOString()
    };

    students.push(newStudent);
    saveData();

    document.getElementById('studentName').value = '';
    document.getElementById('studentLevel').value = '';
    document.getElementById('studentCode').value = '';

    updateDisplay();
    showMessage('✅ تم إضافة التلميذ: ' + name, 'success');
    playBeep('success');
}

function deleteStudent(id) {
    if (confirm('هل أنت متأكد من حذف هذا التلميذ؟')) {
        students = students.filter(s => s.id !== id);

        Object.keys(attendance).forEach(date => {
            attendance[date] = attendance[date].filter(sId => sId !== id);
        });

        saveData();
        updateDisplay();
        showMessage('تم حذف التلميذ', 'warning');
    }
}

// ================ إعادة تعيين حضور اليوم ================
function resetTodayAttendance() {
    if (confirm('هل أنت متأكد من إعادة تعيين حضور اليوم؟')) {
        attendance[today] = [];
        saveData();
        updateDisplay();
        showMessage('تم إعادة تعيين حضور اليوم', 'success');
    }
}

// ================ تحديث العرض ================
function updateDisplay() {
    const todayAttendance = attendance[today] || [];

    document.getElementById('totalStudentsStat').textContent = students.length;
    document.getElementById('presentStudentsStat').textContent = todayAttendance.length;
    document.getElementById('absentStudentsStat').textContent = students.length - todayAttendance.length;

    // الحاضرون
    const presentStudents = students.filter(s => todayAttendance.includes(s.id));
    document.getElementById('presentList').innerHTML = presentStudents.map(s =>
        `<li>
            <span>${s.name}</span>
            <span class="student-code">${s.code}</span>
        </li>`
    ).join('');
    document.getElementById('presentCount').textContent = presentStudents.length;

    // الغائبون
    const absentStudents = students.filter(s => !todayAttendance.includes(s.id));
    document.getElementById('absentList').innerHTML = absentStudents.map(s =>
        `<li>
            <span>${s.name}</span>
            <span class="student-code">${s.code}</span>
        </li>`
    ).join('');
    document.getElementById('absentCount').textContent = absentStudents.length;

    // قائمة جميع التلاميذ (مع إضافة المستوى وزر البطاقة)
    document.getElementById('allStudentsList').innerHTML = students.map(s =>
        `<li>
            <div>
                <strong>${s.name}</strong>
                <span style="color:#666;margin-right:10px;">المستوى: ${s.level || 'غير محدد'}</span>
                <span style="color:#666;margin-right:10px;">الرمز: ${s.code}</span>
            </div>
            <div class="student-actions">
                <button class="barcode-btn" onclick="generateBarcodeForStudent('${s.code}', '${s.name}')">🏷️ باركود</button>
                <button class="card-btn" onclick="printCard(${s.id})" style="background:#17a2b8;color:white;">🖨️ بطاقة</button>
                <button class="delete-btn" onclick="deleteStudent(${s.id})">🗑️ حذف</button>
            </div>
        </li>`
    ).join('');

    document.getElementById('totalStudents').textContent = students.length;
}

// ================ توليد الباركود ================
function generateAllBarcodes() {
    if (students.length === 0) {
        showMessage('❌ لا يوجد تلاميذ مسجلين', 'error');
        return;
    }

    const container = document.getElementById('barcodeContainer');
    container.innerHTML = '';

    students.forEach(student => {
        addBarcodeItem(student.name, student.code);
    });
    showMessage('✅ تم توليد جميع الباركودات', 'success');
}

function generateBarcodeForStudent(code, name) {
    switchTab('barcodes');
    addBarcodeItem(name, code);
    showMessage('✅ تم توليد باركود لـ ' + name, 'success');
}

function addBarcodeItem(name, code) {
    const container = document.getElementById('barcodeContainer');

    const existingBarcode = document.getElementById(`barcode-item-${code}`);
    if (existingBarcode) {
        showMessage('⚠️ هذا الباركود موجود بالفعل', 'warning');
        return;
    }

    const item = document.createElement('div');
    item.className = 'barcode-item';
    item.id = `barcode-item-${code}`;

    item.innerHTML = `
        <h3>${name}</h3>
        <svg id="barcode-${code}"></svg>
        <p>الرمز: ${code}</p>
        <button onclick="removeBarcode('${code}')">🗑️ حذف</button>
    `;

    container.appendChild(item);

    setTimeout(() => {
        try {
            JsBarcode(`#barcode-${code}`, code, {
                format: "CODE128",
                width: 2,
                height: 60,
                displayValue: true,
                margin: 5
            });
        } catch (error) {
            console.error('خطأ في توليد الباركود:', error);
            showMessage('❌ فشل في توليد الباركود', 'error');
            item.remove();
        }
    }, 100);
}

function removeBarcode(code) {
    const item = document.getElementById(`barcode-item-${code}`);
    if (item) {
        item.remove();
        showMessage('🗑️ تم حذف الباركود', 'warning');
    }
}

function clearBarcodes() {
    if (confirm('هل تريد مسح جميع الباركودات؟')) {
        document.getElementById('barcodeContainer').innerHTML = '';
        showMessage('🗑️ تم مسح جميع الباركودات', 'warning');
    }
}

// ================ طباعة البطاقات ================
function buildCardHTML(student) {
    return `
        <div class="student-card">
            <div class="school-name-card">🏫 ثانوية علي بن ربيعة الخاصة</div>
            <div class="student-name">${student.name}</div>
            <div class="student-level">المستوى: ${student.level || 'غير محدد'}</div>
            <div class="student-code">الرمز: ${student.code}</div>
            <svg id="barcode-${student.id}"></svg>
        </div>
    `;
}

function printCard(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showMessage('❌ التلميذ غير موجود', 'error');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        showMessage('❌ يرجى السماح للنوافذ المنبثقة', 'error');
        return;
    }

    const html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>بطاقة التلميذ - ${student.name}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f0f0; }
            .student-card {
                border: 2px solid #333;
                border-radius: 10px;
                padding: 20px;
                width: 280px;
                text-align: center;
                background: white;
                box-shadow: 0 5px 10px rgba(0,0,0,0.1);
            }
            .school-name-card {
                font-size: 1.2rem;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 8px;
                border-bottom: 2px solid #333;
                padding-bottom: 5px;
            }
            .student-name {
                font-size: 1.4rem;
                font-weight: bold;
                margin: 10px 0 5px;
            }
            .student-level {
                font-size: 1rem;
                color: #555;
                margin: 5px 0;
            }
            .student-code {
                font-size: 0.9rem;
                color: #999;
                margin: 5px 0 10px;
            }
            svg {
                max-width: 100%;
                height: auto;
            }
            @media print {
                body { background: white; }
                .student-card { border: 1px solid #000; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        ${buildCardHTML(student)}
        <script>
            window.onload = function() {
                try {
                    JsBarcode("#barcode-${student.id}", "${student.code}", {
                        format: "CODE128",
                        width: 2,
                        height: 80,
                        displayValue: true,
                        margin: 5
                    });
                    // بعد توليد الباركود نطبع
                    setTimeout(function() {
                        window.print();
                    }, 500);
                } catch(e) {
                    alert("خطأ في توليد الباركود: " + e.message);
                }
            };
        <\/script>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

function printAllCards() {
    if (students.length === 0) {
        showMessage('❌ لا يوجد تلاميذ لطباعة بطاقاتهم', 'error');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showMessage('❌ يرجى السماح للنوافذ المنبثقة', 'error');
        return;
    }

    const cardsHTML = students.map(s => buildCardHTML(s)).join('');

    const html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>بطاقات جميع التلاميذ</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background: white; padding: 20px; }
            .card-container {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                justify-content: center;
            }
            .student-card {
                border: 2px solid #333;
                border-radius: 10px;
                padding: 20px;
                width: 280px;
                text-align: center;
                background: white;
                box-shadow: 0 5px 10px rgba(0,0,0,0.1);
                page-break-inside: avoid;
            }
            .school-name-card {
                font-size: 1.2rem;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 8px;
                border-bottom: 2px solid #333;
                padding-bottom: 5px;
            }
            .student-name {
                font-size: 1.4rem;
                font-weight: bold;
                margin: 10px 0 5px;
            }
            .student-level {
                font-size: 1rem;
                color: #555;
                margin: 5px 0;
            }
            .student-code {
                font-size: 0.9rem;
                color: #999;
                margin: 5px 0 10px;
            }
            svg {
                max-width: 100%;
                height: auto;
            }
            @media print {
                .student-card { border: 1px solid #000; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="card-container">
            ${cardsHTML}
        </div>
        <script>
            window.onload = function() {
                // توليد الباركود لكل بطاقة
                ${students.map(s => `
                    try {
                        JsBarcode("#barcode-${s.id}", "${s.code}", {
                            format: "CODE128",
                            width: 2,
                            height: 80,
                            displayValue: true,
                            margin: 5
                        });
                    } catch(e) { console.error(e); }
                `).join('')}
                setTimeout(function() {
                    window.print();
                }, 500);
            };
        <\/script>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

// ================ التصدير ================
function exportAttendance() {
    const todayAttendance = attendance[today] || [];
    const presentStudents = students.filter(s => todayAttendance.includes(s.id));
    const absentStudents = students.filter(s => !todayAttendance.includes(s.id));

    let report = 'تقرير الحضور - ' + today + '\n\n';
    report += 'الحاضرون (' + presentStudents.length + '):\n';
    presentStudents.forEach(s => {
        report += '- ' + s.name + ' (' + s.code + ')\n';
    });

    report += '\nالغائبون (' + absentStudents.length + '):\n';
    absentStudents.forEach(s => {
        report += '- ' + s.name + ' (' + s.code + ')\n';
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-report-' + today + '.txt';
    a.click();
    URL.revokeObjectURL(url);

    showMessage('✅ تم تصدير التقرير', 'success');
}

function exportStudents() {
    let data = 'قائمة التلاميذ\n\n';
    students.forEach(s => {
        data += s.name + ' - ' + (s.level || 'غير محدد') + ' - ' + s.code + '\n';
    });

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-list.txt';
    a.click();
    URL.revokeObjectURL(url);

    showMessage('✅ تم تصدير قائمة التلاميذ', 'success');
}

// ================ حفظ البيانات ================
function saveData() {
    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('attendance', JSON.stringify(attendance));
}

// ================ التهيئة الأولية ================
updateDateDisplay();
updateDisplay();

window.addEventListener('load', function() {
    document.getElementById('scanInput').focus();
});

setInterval(() => {
    const newToday = new Date().toISOString().split('T')[0];
    if (newToday !== today) {
        today = newToday;
        updateDisplay();
        updateDateDisplay();
    }
}, 60000);

window.addEventListener('beforeunload', function() {
    if (isCameraScanning) {
        stopCamera();
    }
});