const express = require("express");
const axios = require("axios");
const path = require("path");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cron = require("node-cron"); // Library untuk jadwal otomatis
const app = express();
const http = require("http");
const { WebSocketServer } = require("ws");



// ====== KONFIGURASI PORT ======
const PORT = process.env.PORT || 3000;

// ====== MIDDLEWARE ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== KONFIGURASI FILE STATIS ======
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/pages", express.static(path.join(__dirname, "pages")));

// ====== KONEKSI MONGODB (CLOUD/ONLINE) ======
// Menggunakan akun MongoDB Atlas yang baru saja Anda buat

mongoose.connect("mongodb+srv://payakumbuhnada_db_user:skyweather123@cluster0.y5bc82f.mongodb.net/skyweather?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ Terhubung ke MongoDB Atlas (Cloud)"))
  .catch((err) => console.error("❌ Gagal Konek MongoDB:", err));

// ====== SKEMA USER ======
const UserSchema = new mongoose.Schema({
  nama: String,
  email: String,
  password: String,
  kota: String
});
const User = mongoose.model("User", UserSchema);

// ====== KONFIGURASI EMAIL ======
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "skyweather075@gmail.com", 
    pass: "lzev dkck kyrg kewz", // App Password
  },
});

// ==========================================================
// 🚨 FITUR: SISTEM PERINGATAN DINI CUACA EKSTREM 🚨
// ==========================================================
// Jadwal: Mengecek setiap 1 Jam (menit ke-0)
cron.schedule('0 * * * *', async () => {
  console.log("⏳ [SISTEM] Memulai pengecekan cuaca ekstrem massal...");

  try {
    // 1. Ambil semua data pengguna
    const allUsers = await User.find({});
    const apiKey = "63ad873c67027e31098767e7984fdd6b";

    if (allUsers.length === 0) {
      console.log("   -> Tidak ada pengguna untuk dicek.");
      return;
    }

    // 2. Loop setiap pengguna
    for (const user of allUsers) {
      if (!user.kota) continue;

      try {
        // Cek Cuaca Kota User
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(user.kota)}&appid=${apiKey}&units=metric&lang=id`;
        const res = await axios.get(url);
        const data = res.data;

        const weatherId = data.weather[0].id; // ID Kode Cuaca
        const deskripsi = data.weather[0].description;
        const suhu = Math.round(data.main.temp);

        // 3. Deteksi Cuaca Ekstrem
        // 200-232: Badai Petir
        // 502-504: Hujan Lebat Ekstrem
        
        let bahaya = false;
        let judulBahaya = "";

        if (weatherId >= 200 && weatherId <= 232) {
          bahaya = true;
          judulBahaya = "BADAI PETIR";
        } else if (weatherId === 502 || weatherId === 503 || weatherId === 504) {
          bahaya = true;
          judulBahaya = "HUJAN SANGAT LEBAT";
        }

        // 4. Kirim Email Jika Bahaya
        if (bahaya) {
          console.log(`⚠️ MENGIRIM PERINGATAN ke ${user.nama} di ${user.kota}`);
          
          const mailOptions = {
            from: '"SkyWeather Alert" <skyweather075@gmail.com>',
            to: user.email,
            subject: `🚨 WASPADA: ${judulBahaya} di ${user.kota}`,
            html: `
              <div style="border: 3px solid red; padding: 20px; font-family: sans-serif; border-radius: 10px;">
                <h1 style="color: #d63031; margin-top:0;">⚠️ PERINGATAN CUACA</h1>
                <p>Halo <strong>${user.nama}</strong>,</p>
                <p>Sistem deteksi dini kami menemukan kondisi cuaca ekstrem di lokasi Anda:</p>
                
                <table style="width:100%; background: #ffeaa7; padding: 10px; border-radius: 5px;">
                  <tr>
                    <td><strong>Lokasi:</strong></td>
                    <td>${user.kota}</td>
                  </tr>
                  <tr>
                    <td><strong>Kondisi:</strong></td>
                    <td style="color: red; font-weight:bold;">${deskripsi.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td><strong>Suhu:</strong></td>
                    <td>${suhu}°C</td>
                  </tr>
                </table>

                <p>Harap berhati-hati saat beraktivitas di luar ruangan.</p>
                <br>
                <small>SkyWeather Protection System</small>
              </div>
            `
          };

          transporter.sendMail(mailOptions, (err) => {
            if (err) console.error("   -> Gagal kirim email:", err);
          });
        } 

      } catch (err) {
        console.error(`   -> Gagal cek kota ${user.kota}:`, err.message);
      }
    }
    console.log("✅ [SISTEM] Pengecekan selesai.");

  } catch (err) {
    console.error("Error Cron Job:", err);
  }
});

// =====================================================
// 🌤️ EMAIL CUACA HARIAN JAM 13:00 (TAMBAHAN)
// =====================================================
cron.schedule("0 13 * * *", async () => {
  console.log("📬 Mengirim email cuaca harian jam 13:00...");
  const apiKey = "63ad873c67027e31098767e7984fdd6b";

  try {
    const users = await User.find({});
    for (const user of users) {
      if (!user.kota || !user.email) continue;

      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(user.kota)}&appid=${apiKey}&units=metric&lang=id`;
        const res = await axios.get(url);
        const w = res.data;

        const mailOptions = {
          from: '"SkyWeather Daily" <skyweather075@gmail.com>',
          to: user.email,
          subject: `🌤️ Cuaca Hari Ini di ${user.kota}`,
          html: `
            <h3>Halo ${user.nama} 👋</h3>
            <p>Informasi cuaca hari ini di kota Anda:</p>
            <ul>
              <li>Kota: ${user.kota}</li>
              <li>Suhu: ${w.main.temp.toFixed(1)}°C</li>
              <li>Kondisi: ${w.weather[0].description}</li>
            </ul>
            <small>Email otomatis SkyWeather</small>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email harian jam 13:00 terkirim ke ${user.email}`);
      } catch (err) {
        console.log(`❌ Gagal kirim ${user.email}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log("Error cron email harian jam 13:00:", err.message);
  }
});


// ====== ROUTES HALAMAN (GET) ======

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
});

app.get("/home.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "home.html"));
});

app.get("/tentang.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "tentang.html"));
});

app.get("/bantuan.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "bantuan.html"));
});

app.get("/berita.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "berita.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "login.html"));
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "register.html"));
});


// ====== LOGIKA REGISTER (POST) ======
app.post("/register", async (req, res) => {
  const { nama, email, password, kota } = req.body;

  try {
    // Cek Email Ganda
    const cekUser = await User.findOne({ email });
    if (cekUser) {
      return res.status(400).json({ message: "Email sudah terdaftar!" });
    }

    // Simpan User Baru
    const newUser = new User({ nama, email, password, kota });
    await newUser.save();

    // Ambil Cuaca Awal untuk Email Welcome
    const apiKey = "63ad873c67027e31098767e7984fdd6b";
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)}&appid=${apiKey}&units=metric&lang=id`;
    
    let infoCuaca = "Data tidak tersedia.";
    try {
      const weatherRes = await axios.get(weatherUrl);
      const w = weatherRes.data;
      infoCuaca = `${Math.round(w.main.temp)}°C, ${w.weather[0].description}`;
    } catch (err) { console.log("Gagal ambil cuaca email"); }

    // Kirim Email Selamat Datang
    const mailOptions = {
      from: "SkyWeather App",
      to: email,
      subject: `Selamat Datang, ${nama}!`,
      html: `
        <h3>Halo ${nama}! 👋</h3>
        <p>Terima kasih telah mendaftar di SkyWeather.</p>
        <p>Cuaca di kota <strong>${kota}</strong> saat ini:</p>
        <h2 style="color:blue;">${infoCuaca}</h2>
        <p>Anda akan menerima notifikasi otomatis jika cuaca memburuk.</p>
        <p>Silakan login untuk melanjutkan.</p>
      `
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) console.log("Gagal kirim email:", err);
      else console.log(`Email terkirim ke ${email}`);
    });

    res.status(200).json({ message: "Registrasi Berhasil!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ====== LOGIKA LOGIN (POST) ======
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (user) {
      res.status(200).json({ message: "Login Berhasil", user });
    } else {
      res.status(401).json({ message: "Email atau Password salah!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// ====== API CUACA (OpenWeatherMap) ======
app.get("/cuaca/:kota", async (req, res) => {
  const apiKey = "63ad873c67027e31098767e7984fdd6b";
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(req.params.kota)}&appid=${apiKey}&units=metric&lang=id`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Gagal ambil cuaca" });
  }
});

// ====== API BERITA (Mediastack) ======
app.get("/api/berita", async (req, res) => {
  const apiKey = "71d6f959749f464eb7245b216c4273e9";
  const url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&keywords=cuaca&limit=5`;

  try {
    const response = await axios.get(url);

    let articles = response.data?.data || [];

    // filter yang punya judul & url
    articles = articles.filter(a => a.title && a.url);

    // fallback kalau kosong
    if (articles.length === 0) {
      articles = [
        {
          title: "BMKG: Peringatan Cuaca Ekstrem",
          description: "Waspada hujan lebat dan angin kencang di beberapa wilayah.",
          url: "https://www.bmkg.go.id",
          source: "BMKG",
          published_at: new Date().toISOString()
        }
      ];
    }

    res.json(articles);
  } catch (error) {
    console.error("Error API Berita:", error.response?.data || error.message);
    res.status(500).json([]);
  }
});


// ====== SERVER HTTP ======
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ====== WEBSOCKET CHATBOT ======
wss.on("connection", (ws) => {
  console.log("🤖 Client chatbot terhubung");

  ws.on("message", (message) => {
    const msg = message.toString().toLowerCase().trim();
    let reply = "";

    // ===== GREETING =====
    if (/halo|hai|hi|selamat/.test(msg)) {
      reply = "Halo 👋 Saya SkyBot. Kamu mau cek cuaca, berita, bantuan, atau profile?";
    }

    // ===== CUACA =====
    else if (/cuaca|hujan|panas|dingin|berawan/.test(msg)) {
      reply = "Untuk cek cuaca 🌤️, ketik **nama kota** di kolom utama ya.";
    }

    // ===== BERITA =====
    else if (/berita|info|kabar|artikel/.test(msg)) {
      reply = "Berita cuaca bisa kamu lihat di menu **📢 Berita** di bagian atas website.";
    }

    // ===== BANTUAN =====
    else if (/bantuan|help|cara|panduan/.test(msg)) {
      reply = "Menu **Bantuan** berisi panduan penggunaan SkyWeather ℹ️";
    }

    // ===== PROFILE (INI YANG KAMU MINTA) =====
    else if (/profile|profil|akun|data saya|akun saya|edit/.test(msg)) {
      reply = "Menu **👤 Profile** berisi data akun kamu dan pengaturan pengguna. Silakan klik menu **Profile** di navbar atas.";
    }

    // ===== USER BINGUNG =====
    else if (/ga paham|kok|kenapa|bingung/.test(msg)) {
      reply = "Tenang 😊 Kamu bisa tanya tentang **cuaca**, **berita**, **bantuan**, atau **profile**.";
    }

    // ===== FALLBACK =====
    else {
      reply = `Maaf, aku belum memahami pertanyaan kamu 😅  
Coba ketik:
• cuaca  
• berita  
• bantuan  
• profile`;
    }

    ws.send(reply);
  });

  ws.on("close", () => {
    console.log("❌ Client chatbot terputus");
  });
});


// ====== JALANKAN SERVER ======
server.listen(PORT, () => {
  console.log(`🚀 Server + WebSocket aktif di http://localhost:${PORT}`);
});
