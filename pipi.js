const dial = document.getElementById('tempDial');
const dialTemp = document.getElementById('dial-temp');
const tempMain = document.getElementById('temp-main');
const manualLightButton = document.getElementById('manualLight');
const setTimerButton = document.getElementById('setTimer');
const countdownText = document.getElementById('countdown-text');

// Popup Konfirmasi Manual
const confirmPopup = document.getElementById('confirmPopup');
const popupYes = document.getElementById('popup-yes');
const popupNo = document.getElementById('popup-no');
const popupMessage = document.getElementById('popup-message');

// Popup Time Picker
const timePickerPopup = document.getElementById('timePickerPopup');
const timeInput = document.getElementById('timeInput');
const setTimerConfirm = document.getElementById('setTimerConfirm');
const setTimerCancel = document.getElementById('setTimerCancel');

// --- VARIABEL & DEFAULT ---
const VOLTAGE = 3.7; 
let scheduledTime = null; 
let lampStatus = 'OFF';

// --- FUNGSI UTILITAS WAKTU (Tidak Berubah) ---

function calculateNextScheduledTime(timeString) {
    if (!timeString) return null;
    const now = new Date();
    const [h, m] = timeString.split(':').map(Number);
    let nextTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (nextTime.getTime() < now.getTime()) {
        nextTime.setDate(nextTime.getDate() + 1);
    }
    return nextTime;
}

function formatCountdown(ms) {
    if (ms <= 0) return "Waktu Habis!";
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds %= 60;
    minutes %= 60;
    
    const hDisplay = String(hours).padStart(2, '0');
    const mDisplay = String(minutes).padStart(2, '0');
    const sDisplay = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${hDisplay}j ${mDisplay}m ${sDisplay}d`;
    } else if (minutes > 0) {
        return `${mDisplay}m ${sDisplay}d`;
    } else {
        return `${sDisplay} detik`;
    }
}

// --- FUNGSI UPDATE VISUAL (Tidak Berubah) ---

function updateVisuals() {
    tempMain.textContent = VOLTAGE; 

    dialTemp.textContent = lampStatus;
    
    if (lampStatus === 'ON') {
        dial.style.opacity = 1; 
        dial.style.boxShadow = '0 0 30px rgba(76, 217, 100, 0.7)';
    } else {
        dial.style.opacity = 0.4; 
        dial.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
    }

    if (scheduledTime && lampStatus === 'OFF') {
        const now = new Date();
        const timeRemaining = scheduledTime.getTime() - now.getTime();

        if (timeRemaining > 0) {
            countdownText.textContent = `Nyala dlm ${formatCountdown(timeRemaining)}`;
        } else {
            countdownText.textContent = "Menunggu Nyala..."; 
        }
    } else if (lampStatus === 'ON') {
         countdownText.textContent = "Lampu Menyala"; 
    } else {
        countdownText.textContent = "Lampu"; 
    }
}

// --- FUNGSI LOGIKA UTAMA (Tidak Berubah) ---

function activateLamp(isManual = false) {
    if (lampStatus === 'ON') return;
    
    lampStatus = 'ON';
    
    if (isManual) {
        // Ini adalah kunci: Lampu manual selalu membatalkan timer yang ada.
        scheduledTime = null; 
        console.log("Timer dibatalkan. Lampu menyala manual.");
    }

    // Atur waktu mati otomatis (1 jam)
    setTimeout(() => {
        if (lampStatus === 'ON') {
            lampStatus = 'OFF';
            console.log("Lampu Mati Otomatis (Durasi 1 jam habis)");
            updateVisuals();
        }
    }, 60 * 60 * 1000); 

    updateVisuals();
}

function runTimerLogic() {
    const now = new Date();
    
    if (scheduledTime && lampStatus === 'OFF') {
        if (now.getTime() >= scheduledTime.getTime()) {
            activateLamp();
            console.log(`[TIMER AKTIF] Lampu menyala otomatis pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
            
            // Jadwalkan kembali untuk hari berikutnya
            const [h, m] = [scheduledTime.getHours(), scheduledTime.getMinutes()];
            let nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            scheduledTime = nextDay; 
        }
    }

    updateVisuals();
}

// --- EVENT LISTENERS YANG DIUBAH ---

// 1. Event Tombol Lampu Manual
manualLightButton.addEventListener('click', () => {
    if (lampStatus === 'ON') {
        // KONDISI 1: Jika sudah nyala, matikan saja (Tanpa Pop-up)
        lampStatus = 'OFF';
        scheduledTime = null; 
        updateVisuals();
        console.log("Lampu dimatikan manual.");
        return;
    }

    // KONDISI 2: Lampu sedang OFF
    
    // SELALU Tampilkan popup konfirmasi dengan teks yang diminta
    popupMessage.textContent = "Apakah anda ingin menyalakan lampu?";
    confirmPopup.style.display = 'flex';
});

// 2. Event Pop-up Konfirmasi - YA
// Logika ini sudah sesuai: Lampu NYALA dan timer BATAL (karena memanggil activateLamp(true))
popupYes.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    activateLamp(true); // Lampu NYALA + Timer BATAL
});

// 3. Event Pop-up Konfirmasi - TIDAK
// Logika ini sudah sesuai: Lampu TETAP MATI, timer LANJUT
popupNo.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    // Tidak melakukan apa-apa, lampu tetap OFF dan scheduledTime (timer) tetap berjalan
    console.log("Pengguna memilih melanjutkan timer/lampu tetap mati.");
});


// 4. Event Tombol Set Timer (Buka Time Picker) (Tidak Berubah)
setTimerButton.addEventListener('click', () => {
    timePickerPopup.style.display = 'flex';
    if (scheduledTime) {
        const defaultTime = scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        timeInput.value = defaultTime;
    } else {
        timeInput.value = '18:00'; 
    }
});

// 5. Event Konfirmasi Set Timer (Tidak Berubah)
setTimerConfirm.addEventListener('click', () => {
    const timeValue = timeInput.value;
    if (timeValue) {
        scheduledTime = calculateNextScheduledTime(timeValue);
        lampStatus = 'OFF'; 
        timePickerPopup.style.display = 'none';
        updateVisuals();
        console.log(`Timer berhasil disetel: Lampu akan menyala pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
    } else {
        alert("Mohon masukkan waktu.");
    }
});

// 6. Event Batal Set Timer (Tidak Berubah)
setTimerCancel.addEventListener('click', () => {
    timePickerPopup.style.display = 'none';
});


// --- INTERVAL UTAMA ---
// Jalankan logika setiap 1 detik
setInterval(runTimerLogic, 1000); 

// Jalankan fungsi saat pertama kali dimuat
updateVisuals();
