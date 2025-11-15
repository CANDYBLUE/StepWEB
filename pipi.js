// Anda HARUS memasukkan library Paho MQTT di HTML Anda:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>


// --- KONFIGURASI MQTT WEB ---
const BROKER_HOST = 'io.adafruit.com'; 
const BROKER_PORT = 80; 

// Ganti nilai ini dengan KREDENSIAL ANDA:
const USERNAME = "StepVolt"; // AIO Username Anda
// CATATAN: Web MQTT client tidak perlu AIO Key (password) saat menggunakan Adafruit IO

// Topic harus sesuai dengan yang ada di ESP32:
const KONTROL_TOPIC = USERNAME + "/feeds/kontrol-lampu"; 
const DATA_TOPIC = USERNAME + "/feeds/data-baterai"; 

const CLIENT_ID = "WebApp-" + parseInt(Math.random() * 1000, 10);
let mqttClient = null;


// --- ELEMEN DOM (Tidak Berubah) ---
const dial = document.getElementById('tempDial');
const dialTemp = document.getElementById('dial-temp');
const tempMain = document.getElementById('temp-main');
const manualLightButton = document.getElementById('manualLight');
const setTimerButton = document.getElementById('setTimer');
const countdownText = document.getElementById('countdown-text');
const outsideTempDisplay = document.querySelector('.outside-temp'); // Tambahan untuk display persentase

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
// Nilai ini sekarang akan di-update oleh MQTT, bukan konstanta
let currentVoltage = 0.0; 
let scheduledTime = null; 
let lampStatus = 'OFF'; // Status awal, akan di-update oleh MQTT

// ----------------------------------------------------------------------
// --- FUNGSI MQTT ---
// ----------------------------------------------------------------------

// 1. Mengirim Perintah ke ESP32
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

// 2. Dipanggil Saat Pesan Diterima (Menerima Data dari ESP32)
function onMessageArrived(message) {
    if (message.destinationName === DATA_TOPIC) {
        try {
            const data = JSON.parse(message.payloadString);
            
            // 2A. Update Voltase dan Status Lampu Lokal
            currentVoltage = parseFloat(data.V);
            lampStatus = data.status; // Menerima status aktual dari ESP32
            
            // 2B. Hitung Persentase (Asumsi 4.2V = 100%)
            const maxVoltage = 4.2; 
            const percentage = Math.min(100, Math.round((currentVoltage / maxVoltage) * 100)); 
            
            // 2C. Update Display
            tempMain.textContent = `${currentVoltage.toFixed(1)}V`; 
            outsideTempDisplay.textContent = `${percentage}% Battery | ${lampStatus === 'ON' ? 'Lampu ON' : 'OFF'}`;

            updateVisuals();
            console.log(`MQTT: Data received: V=${currentVoltage.toFixed(2)}, Status=${lampStatus}`);

        } catch (e) {
            console.error("MQTT: Failed to parse JSON data:", e);
        }
    }
}

// 3. Mengatur Koneksi
function onConnect() {
    console.log("MQTT Connected!");
    mqttClient.subscribe(DATA_TOPIC); // Mulai mendengarkan status dari ESP32
}

function onFailure(message) {
    console.error("MQTT Connection failed: " + message.errorMessage);
    // Coba hubungkan kembali setelah 3 detik
    setTimeout(MQTTconnect, 3000); 
}

function MQTTconnect() {
    // Kredensial Adafruit IO tidak memerlukan password untuk Web client
    mqttClient = new Paho.MQTT.Client(BROKER_HOST, BROKER_PORT, CLIENT_ID);
    mqttClient.onConnectionLost = onFailure;
    mqttClient.onMessageArrived = onMessageArrived;

    var options = {
        timeout: 3,
        userName: USERNAME,
        password: '', // Tidak perlu AIO Key di sini, hanya perlu Username (diisi di opsi connect)
        onSuccess: onConnect,
        onFailure: onFailure
    };
    
    // Khusus untuk Adafruit IO, kita bisa menggunakan User Name di URL
    mqttClient.connect(options);
}


// ----------------------------------------------------------------------
// --- FUNGSI UPDATE VISUAL (Diubah untuk menggunakan currentVoltage) ---
// ----------------------------------------------------------------------

function updateVisuals() {
    // tempMain.textContent sudah diupdate di onMessageArrived
    
    dialTemp.textContent = lampStatus;
    
    if (lampStatus === 'ON') {
        dial.style.opacity = 1; 
        dial.style.boxShadow = '0 0 30px rgba(76, 217, 100, 0.7)';
    } else {
        dial.style.opacity = 0.4; 
        dial.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
    }

    // Logika Timer/Countdown (Tidak Berubah)
    if (scheduledTime && lampStatus === 'OFF') {
        // ... (Kode Countdown tetap sama)
    } else if (lampStatus === 'ON') {
         countdownText.textContent = "Lampu Menyala"; 
    } else {
        countdownText.textContent = "Lampu"; 
    }

    // PENTING: Update Voltase di UI jika belum ada data MQTT
    if (currentVoltage === 0.0) {
        tempMain.textContent = "Menghubungkan...";
        outsideTempDisplay.textContent = "Menunggu Data ESP32";
    }
}


// ----------------------------------------------------------------------
// --- FUNGSI LOGIKA UTAMA (Diubah untuk menggunakan sendCommand) ---
// ----------------------------------------------------------------------

function activateLamp(isManual = false) {
    if (lampStatus === 'ON') return;
    
    // KIRIM PERINTAH NYALA ke ESP32
    sendCommand('ON'); 
    
    if (isManual) {
        scheduledTime = null; 
        console.log("Timer dibatalkan. Perintah ON dikirim.");
    }
    
    // Klien Web tidak mengatur waktu mati, karena ESP32 yang akan mematikan
    // (Anda harus menambahkan logika 1 jam mati otomatis di kode ESP32!)

    // Update visual LOKAL segera (opsional, tapi disarankan)
    // lampStatus = 'ON'; // Lebih baik menunggu balasan status dari ESP32 via MQTT

    updateVisuals();
}

function runTimerLogic() {
    const now = new Date();
    
    if (scheduledTime && lampStatus === 'OFF') {
        if (now.getTime() >= scheduledTime.getTime()) {
            activateLamp(); // Memanggil sendCommand('ON')
            console.log(`[TIMER AKTIF] Perintah ON dikirim pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
            
            // Jadwalkan kembali untuk hari berikutnya
            const [h, m] = [scheduledTime.getHours(), scheduledTime.getMinutes()];
            let nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            scheduledTime = nextDay; 
        }
    }

    // updateVisuals() dipanggil juga oleh MQTT, tapi kita tetap memanggilnya di sini
    // untuk memastikan countdown timer berjalan lancar.
    updateVisuals(); 
}

// ----------------------------------------------------------------------
// --- EVENT LISTENERS YANG DIUBAH UNTUK MQTT ---
// ----------------------------------------------------------------------

// 1. Event Tombol Lampu Manual
manualLightButton.addEventListener('click', () => {
    if (lampStatus === 'ON') {
        // KONDISI 1: Jika sudah nyala, kirim perintah OFF (Tanpa Pop-up)
        sendCommand('OFF'); // Kirim perintah matikan
        scheduledTime = null; 
        // Status lampStatus akan diupdate oleh balasan MQTT dari ESP32
        updateVisuals();
        console.log("Perintah OFF dikirim manual.");
        return;
    }

    // KONDISI 2: Lampu sedang OFF, Tampilkan popup
    popupMessage.textContent = "Apakah anda ingin menyalakan lampu?";
    confirmPopup.style.display = 'flex';
});

// 2. Event Pop-up Konfirmasi - YA
popupYes.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    activateLamp(true); // Kirim perintah ON
});


// 3. Event Pop-up Konfirmasi - TIDAK (Tidak Berubah)
popupNo.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    console.log("Pengguna memilih melanjutkan timer/lampu tetap mati.");
});


// --- INTERVAL UTAMA & INISIALISASI ---

// Jalankan logika timer setiap 1 detik
setInterval(runTimerLogic, 1000); 

// MULAI KONEKSI MQTT SAAT APLIKASI WEB DIMUAT
MQTTconnect(); 
// Anda HARUS memasukkan library Paho MQTT di HTML Anda:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>


// --- KONFIGURASI MQTT WEB ---
const BROKER_HOST = 'io.adafruit.com'; 
const BROKER_PORT = 80; 

// Ganti nilai ini dengan KREDENSIAL ANDA:
const USERNAME = "StepVolt"; // AIO Username Anda
// CATATAN: Web MQTT client tidak perlu AIO Key (password) saat menggunakan Adafruit IO

// Topic harus sesuai dengan yang ada di ESP32:
const KONTROL_TOPIC = USERNAME + "/feeds/kontrol-lampu"; 
const DATA_TOPIC = USERNAME + "/feeds/data-baterai"; 

const CLIENT_ID = "WebApp-" + parseInt(Math.random() * 1000, 10);
let mqttClient = null;


// --- ELEMEN DOM (Tidak Berubah) ---
const dial = document.getElementById('tempDial');
const dialTemp = document.getElementById('dial-temp');
const tempMain = document.getElementById('temp-main');
const manualLightButton = document.getElementById('manualLight');
const setTimerButton = document.getElementById('setTimer');
const countdownText = document.getElementById('countdown-text');
const outsideTempDisplay = document.querySelector('.outside-temp'); // Tambahan untuk display persentase

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
// Nilai ini sekarang akan di-update oleh MQTT, bukan konstanta
let currentVoltage = 0.0; 
let scheduledTime = null; 
let lampStatus = 'OFF'; // Status awal, akan di-update oleh MQTT

// ----------------------------------------------------------------------
// --- FUNGSI MQTT ---
// ----------------------------------------------------------------------

// 1. Mengirim Perintah ke ESP32
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

// 2. Dipanggil Saat Pesan Diterima (Menerima Data dari ESP32)
function onMessageArrived(message) {
    if (message.destinationName === DATA_TOPIC) {
        try {
            const data = JSON.parse(message.payloadString);
            
            // 2A. Update Voltase dan Status Lampu Lokal
            currentVoltage = parseFloat(data.V);
            lampStatus = data.status; // Menerima status aktual dari ESP32
            
            // 2B. Hitung Persentase (Asumsi 4.2V = 100%)
            const maxVoltage = 4.2; 
            const percentage = Math.min(100, Math.round((currentVoltage / maxVoltage) * 100)); 
            
            // 2C. Update Display
            tempMain.textContent = `${currentVoltage.toFixed(1)}V`; 
            outsideTempDisplay.textContent = `${percentage}% Battery | ${lampStatus === 'ON' ? 'Lampu ON' : 'OFF'}`;

            updateVisuals();
            console.log(`MQTT: Data received: V=${currentVoltage.toFixed(2)}, Status=${lampStatus}`);

        } catch (e) {
            console.error("MQTT: Failed to parse JSON data:", e);
        }
    }
}

// 3. Mengatur Koneksi
function onConnect() {
    console.log("MQTT Connected!");
    mqttClient.subscribe(DATA_TOPIC); // Mulai mendengarkan status dari ESP32
}

function onFailure(message) {
    console.error("MQTT Connection failed: " + message.errorMessage);
    // Coba hubungkan kembali setelah 3 detik
    setTimeout(MQTTconnect, 3000); 
}

function MQTTconnect() {
    // Kredensial Adafruit IO tidak memerlukan password untuk Web client
    mqttClient = new Paho.MQTT.Client(BROKER_HOST, BROKER_PORT, CLIENT_ID);
    mqttClient.onConnectionLost = onFailure;
    mqttClient.onMessageArrived = onMessageArrived;

    var options = {
        timeout: 3,
        userName: USERNAME,
        password: '', // Tidak perlu AIO Key di sini, hanya perlu Username (diisi di opsi connect)
        onSuccess: onConnect,
        onFailure: onFailure
    };
    
    // Khusus untuk Adafruit IO, kita bisa menggunakan User Name di URL
    mqttClient.connect(options);
}


// ----------------------------------------------------------------------
// --- FUNGSI UPDATE VISUAL (Diubah untuk menggunakan currentVoltage) ---
// ----------------------------------------------------------------------

function updateVisuals() {
    // tempMain.textContent sudah diupdate di onMessageArrived
    
    dialTemp.textContent = lampStatus;
    
    if (lampStatus === 'ON') {
        dial.style.opacity = 1; 
        dial.style.boxShadow = '0 0 30px rgba(76, 217, 100, 0.7)';
    } else {
        dial.style.opacity = 0.4; 
        dial.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
    }

    // Logika Timer/Countdown (Tidak Berubah)
    if (scheduledTime && lampStatus === 'OFF') {
        // ... (Kode Countdown tetap sama)
    } else if (lampStatus === 'ON') {
         countdownText.textContent = "Lampu Menyala"; 
    } else {
        countdownText.textContent = "Lampu"; 
    }

    // PENTING: Update Voltase di UI jika belum ada data MQTT
    if (currentVoltage === 0.0) {
        tempMain.textContent = "Menghubungkan...";
        outsideTempDisplay.textContent = "Menunggu Data ESP32";
    }
}


// ----------------------------------------------------------------------
// --- FUNGSI LOGIKA UTAMA (Diubah untuk menggunakan sendCommand) ---
// ----------------------------------------------------------------------

function activateLamp(isManual = false) {
    if (lampStatus === 'ON') return;
    
    // KIRIM PERINTAH NYALA ke ESP32
    sendCommand('ON'); 
    
    if (isManual) {
        scheduledTime = null; 
        console.log("Timer dibatalkan. Perintah ON dikirim.");
    }
    
    // Klien Web tidak mengatur waktu mati, karena ESP32 yang akan mematikan
    // (Anda harus menambahkan logika 1 jam mati otomatis di kode ESP32!)

    // Update visual LOKAL segera (opsional, tapi disarankan)
    // lampStatus = 'ON'; // Lebih baik menunggu balasan status dari ESP32 via MQTT

    updateVisuals();
}

function runTimerLogic() {
    const now = new Date();
    
    if (scheduledTime && lampStatus === 'OFF') {
        if (now.getTime() >= scheduledTime.getTime()) {
            activateLamp(); // Memanggil sendCommand('ON')
            console.log(`[TIMER AKTIF] Perintah ON dikirim pada ${scheduledTime.toLocaleTimeString('id-ID')}`);
            
            // Jadwalkan kembali untuk hari berikutnya
            const [h, m] = [scheduledTime.getHours(), scheduledTime.getMinutes()];
            let nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            scheduledTime = nextDay; 
        }
    }

    // updateVisuals() dipanggil juga oleh MQTT, tapi kita tetap memanggilnya di sini
    // untuk memastikan countdown timer berjalan lancar.
    updateVisuals(); 
}

// ----------------------------------------------------------------------
// --- EVENT LISTENERS YANG DIUBAH UNTUK MQTT ---
// ----------------------------------------------------------------------

// 1. Event Tombol Lampu Manual
manualLightButton.addEventListener('click', () => {
    if (lampStatus === 'ON') {
        // KONDISI 1: Jika sudah nyala, kirim perintah OFF (Tanpa Pop-up)
        sendCommand('OFF'); // Kirim perintah matikan
        scheduledTime = null; 
        // Status lampStatus akan diupdate oleh balasan MQTT dari ESP32
        updateVisuals();
        console.log("Perintah OFF dikirim manual.");
        return;
    }

    // KONDISI 2: Lampu sedang OFF, Tampilkan popup
    popupMessage.textContent = "Apakah anda ingin menyalakan lampu?";
    confirmPopup.style.display = 'flex';
});

// 2. Event Pop-up Konfirmasi - YA
popupYes.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    activateLamp(true); // Kirim perintah ON
});


// 3. Event Pop-up Konfirmasi - TIDAK (Tidak Berubah)
popupNo.addEventListener('click', () => {
    confirmPopup.style.display = 'none';
    console.log("Pengguna memilih melanjutkan timer/lampu tetap mati.");
});


// --- INTERVAL UTAMA & INISIALISASI ---

// Jalankan logika timer setiap 1 detik
setInterval(runTimerLogic, 1000); 

// MULAI KONEKSI MQTT SAAT APLIKASI WEB DIMUAT
MQTTconnect(); 
