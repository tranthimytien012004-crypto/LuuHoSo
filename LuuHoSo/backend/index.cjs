const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Import Route
const SinhVienRoutes = require("./routes/SinhVienRoutes.cjs");

const app = express();

// --- CẤU HÌNH MIDDLEWARE ---
app.use(cors()); // Đã xóa dòng khai báo cors dư thừa
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- ĐĂNG KÝ CÁC ROUTE ---
app.use("/api/students", SinhVienRoutes);

// Route kiểm tra trạng thái server
app.get("/", (req, res) => {
    res.send("Backend Student Record Management is Running...");
});

// --- CẤU HÌNH KẾT NỐI DATABASE ---
const MONGO_URI = "mongodb+srv://tranthimytien012004_db_user:mytien123@cluster0.ln4wid8.mongodb.net/StudentChain?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ Kết nối thành công tới Database: StudentChain");
    
    // --- KHỞI CHẠY SERVER (Chỉ dùng 1 lệnh listen duy nhất) ---
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log("-----------------------------------------");
        console.log(`🚀 Server đang chạy tại cổng: ${PORT}`);
        console.log(`📌 API đã sẵn sàng phục vụ!`);
        console.log("-----------------------------------------");
    });
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối Database:", err.message);
  });

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Đã xảy ra lỗi hệ thống!" });
});