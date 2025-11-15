// Anda HARUS memasukkan library Paho MQTT di HTML Anda:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>


// --- KONFIGURASI MQTT WEB ---
const BROKER_HOST = 'io.adafruit.com'; 
const BROKER_PORT = 80; 

// KREDENSIAL ANDA (Harus sama dengan di ESP32)
const USERNAME = "StepVolt"; 

// TOPIC ANDA (Harus sama dengan di ESP32)
const KONTROL_TOPIC = USERNAME + "/feeds/kontrol-lampu"; 
const DATA_TOPIC = USERNAME + "/feeds/data-baterai"; 

const CLIENT_ID = "WebApp-" + parseInt(Math.random() * 1000, 10);
let mqttClient = null;


// --- ELEMEN DOM (Pastikan ID di HTML sama) ---
const dial = document.getElementById('tempDial');
const dialTemp = document.getElementById('dial-temp');
const tempMain = document.getElementById('temp-main');
const manualLightButton = document.getElementById('manualLight');
const setTimerButton = document.getElementById('setTimer');
const countdownText = document.getElementById('countdown-text');
const outsideTempDisplay = document.querySelector('.outside-temp'); 

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

// --- VARIABEL GLOBAL ---
let currentVoltage = 0.0; 
let scheduledTime = null; 
let lampStatus = 'OFF'; 


// ----------------------------------------------------------------------
// --- FUNGSI UTILITAS WAKTU (UI/Timer Logic) ---
// ----------------------------------------------------------------------

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


// ----------------------------------------------------------------------
// --- FUNGSI KOMUNIKASI MQTT ---
// ----------------------------------------------------------------------

function sendCommand(state) {
    if (mqttClient && mqttClient.isConnected()) {
        const message = new Paho.MQTT.Message(state);
        message.destinationName = KONTROL_TOPIC;
        mqttClient.send(message);
        console.log(`MQTT: Sent command: ${state}`);
    } else {
        console.error("MQTT Client not connected. Command failed.");
        alert("Koneksi ke MQTT Broker gagal. Perintah tidak terkirim.");
    }
}

function onMessageArrived(message) {
    if (message.destinationName === DATA_TOPIC) {
        try {
            const data = JSON.parse(message.payloadString);
            
            currentVoltage = parseFloat(data.V);
            lampStatus = data.status; 
            
            const maxVoltage = 4.2; 
            const percentage = Math.min(100, Math.round((currentVoltage / maxVoltage) * 100)); 
            
            tempMain.textContent = `${currentVoltage.toFixed(1)}V`; 
            outsideTempDisplay.textContent = `${percentage}% Battery | ${lampStatus === 'ON' ? 'Lampu ON' : 'OFF'}`;

            updateVisuals();
            console.log(`MQTT: Data received: V=${currentVoltage.toFixed(2)}, Status=${lampStatus}`);

        } catch (e) {
            console.error("MQTT: Failed to parse JSON data:", e);
        }
    }
}

function onConnect() {
    console.log("MQTT Connected!");
    mqttClient.subscribe(DATA_TOPIC); 
}

function onFailure(message) {
    console.error("MQTT Connection failed: " + message.errorMessage);
    setTimeout(MQTTconnect, 3000); 
}

function MQTTconnect() {
    mqttClient = new Paho.MQTT.Client(BROKER_HOST, BROKER_PORT, CLIENT_ID);
    mqttClient.onConnectionLost = onFailure;
    mqttClient.onMessageArrived = onMessageArrived;

    var options = {
        timeout: 3,
        userName: USERNAME,
        password: '', 
        onSuccess: onConnect,
        onFailure: onFailure
    };
    
    mqttClient.connect(options);
}


// ----------------------------------------------------------------------
// --- FUNGSI UPDATE VISUAL (Mengubah tampilan UI) ---
// ----------------------------------------------------------------------

function updateVisuals() {
    
    dialTemp.textContent = lampStatus;
    
    if (lampStatus === 'ON') {
        dial.style.opacity = 1; 
        dial.style.boxShadow = '0 0 30px rgba(76, 217, 100, 0.7)';
    } else {
        dial.style.opacity = 0.4; 
        dial.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
    }

    // Logika Timer/Countdown
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

    if (currentVoltage === 0.0) {
        tempMain.textContent = "Menghubungkan...";
        outsideTempDisplay.textContent = "Menunggu Data ESP32";
    }
}


// ----------------------------------------------------------------------
// --- FUNGSI LOGIKA UTAMA (Aktivasi Lampu) ---
// ----------------------------------------------------------------------

function activateLamp(isManual = false) {
    // Fungsi ini dipanggil dari Tombol Manual ATAU dari Timer Logic
    if (lampStatus === 'ON') return;
    
    sendCommand('ON'); 
    
    if (isManual) {
        scheduledTime = null; 
        console.log("Timer dibatalkan. Perintah ON dikirim.");
    }

    updateVisuals();
}

function runTimerLogic() {
    const now = new Date();
    
    // Logika ini mengecek apakah waktu timer sudah tercapai
    if (scheduledTime && lampStatus === 'OFF') {
        if (now.getTime() >= scheduledTime.getTime()) {
            activateLamp(); // Mengirim perintah ON via MQTT
            console.log(`[TIMER AKTIF] Perintah ON dikirim pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
            
            // Jadwalkan kembali untuk hari berikutnya
            const [h, m] = [scheduledTime.getHours(), scheduledTime.getMinutes()];
            let nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            scheduledTime = nextDay; 
        }
    }

    updateVisuals(); 
}

// ----------------------------------------------------------------------
// --- EVENT LISTENERS (Menghubungkan UI ke Logika) ---
// ----------------------------------------------------------------------

// 1. Event Tombol Lampu Manual (ON/OFF)
manualLightButton.addEventListener('click', () => {
    if (lampStatus === 'ON') {
        // Jika sudah nyala, kirim perintah OFF dan batalkan timer
        sendCommand('OFF'); 
        scheduledTime = null; 
        updateVisuals();
        console.log("Perintah OFF dikirim manual.");
        return;
    }

    // Jika sedang OFF, tampilkan popup konfirmasi untuk ON
    popupMessage.textContent = "Apakah anda ingin menyalakan lampu?";
    confirmPopup.style.display = 'flex';
});

// 2. Event Pop-up Konfirmasi - YA (Mengirim ON)
popupYes.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    activateLamp(true); // Kirim perintah ON, batalkan timer
});


// 3. Event Pop-up Konfirmasi - TIDAK
popupNo.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    console.log("Pengguna memilih melanjutkan timer/lampu tetap mati.");
});


// 4. Event Tombol Set Timer (Buka Time Picker)
setTimerButton.addEventListener('click', () => {
    timePickerPopup.style.display = 'flex';
    // Mengisi input waktu dengan waktu terjadwal terakhir
    if (scheduledTime) {
        const defaultTime = scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        timeInput.value = defaultTime;
    } else {
        timeInput.value = '18:00'; 
    }
});

// 5. Event Konfirmasi Set Timer
setTimerConfirm.addEventListener('click', () => {
    const timeValue = timeInput.value;
    if (timeValue) {
        scheduledTime = calculateNextScheduledTime(timeValue);
        timePickerPopup.style.display = 'none';
        updateVisuals();
        console.log(`Timer berhasil disetel: Lampu akan menyala pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
    } else {
        alert("Mohon masukkan waktu.");
    }
});

// 6. Event Batal Set Timer
setTimerCancel.addEventListener('click', () => {
    timePickerPopup.style.display = 'none';
});


// --- INI ADALAH TITIK AWAL KODE ---

// Jalankan logika timer/visual setiap 1 detik
setInterval(runTimerLogic, 1000); 

// MULAI KONEKSI MQTT SAAT APLIKASI WEB DIMUAT
MQTTconnect(); 
