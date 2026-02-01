const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Import Route - Đảm bảo file này tồn tại trong thư mục routes
const SinhVienRoutes = require("./routes/SinhVienRoutes.cjs");

const app = express();
const cors = require('cors');
app.use(cors()); 

// --- CẤU HÌNH MIDDLEWARE ---
app.use(cors());
// Tăng giới hạn dữ liệu để xử lý file hồ sơ (Base64) lớn
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- ĐĂNG KÝ CÁC ROUTE ---
// Tất cả các API trong SinhVienRoutes sẽ có tiền tố /api/students
app.use("/api/students", SinhVienRoutes);

// Route kiểm tra trạng thái server (Optional)
app.get("/", (req, res) => {
    res.send("Backend Student Record Management is Running...");
});

// --- CẤU HÌNH KẾT NỐI DATABASE ---
const MONGO_URI = "mongodb+srv://tranthimytien012004_db_user:mytien123@cluster0.ln4wid8.mongodb.net/StudentChain?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ Kết nối thành công tới Database: StudentChain");
        
        // --- KHỞI CHẠY SERVER ---
        const PORT = 5000;
        app.listen(PORT, () => {
            console.log("-----------------------------------------");
            console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
            console.log(`📌 API Login: http://localhost:${PORT}/api/students/wallet-login`);
            console.log(`📌 API Danh sách: http://localhost:${PORT}/api/students/pending-records`);
            console.log("-----------------------------------------");
        });
    })
    .catch((err) => {
        console.error("❌ Lỗi kết nối Database:");
        console.error(err.message);
        console.log("Vui lòng kiểm tra lại Whitelist IP trên MongoDB Atlas!");
    });

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Đã xảy ra lỗi hệ thống!" });
});