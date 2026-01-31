# 🎓 Student Profile Management System (Blockchain Based)

Hệ thống quản lý và xác thực hồ sơ sinh viên sử dụng công nghệ Blockchain (Cronos Testnet), giúp đảm bảo tính toàn vẹn, minh bạch và chống làm giả bằng cấp thông qua mã QR.

---

## 🏗️ Kiến trúc dự án
Dự án được tổ chức theo mô hình Fullstack tách biệt để dễ dàng phát triển và triển khai:

* **`/frontend`**: Giao diện người dùng (ReactJS + Vite). Sử dụng `Ethers.js` để tương tác với Smart Contract và `qrcode.react` để tạo mã xác thực.
* **`/backend`**: RESTful API (Node.js + Express). Kết nối MongoDB Atlas để lưu trữ thông tin định danh và trạng thái hồ sơ.
* **`/blockchain`**: Chứa Smart Contract (Solidity) lưu trữ mã băm (Hash) hồ sơ vĩnh viễn trên mạng Cronos.

---

## 📋 Phân công công việc (Collaborators)

| Thành viên | Nhiệm vụ chính
| Phạm Thị Hoa Tím | Thiết kế Database, Viết API Backend, kiểm thử
|Tràn Thị Mỹ Tiên | Phát triển UI/UX, Tích hợp logic QR Code & MetaMask, kiểm thử
|Cả 2 cùng làm | Deploy Smart Contract
---
## 🚀 Quy trình hoạt động (Workflow)

1.  **Tiếp nhận:** Admin nhập thông tin sinh viên vào hệ thống (Lưu vào MongoDB).
2.  **Số hóa:** Hồ sơ được băm thành chuỗi SHA-256 (Mã băm duy nhất).
3.  **Xác thực:** Admin ký giao dịch qua MetaMask để đẩy mã băm lên Blockchain.
4.  **Cấp phát:** Hệ thống tạo mã QR chứa link xác thực (URL + FileHash).
5.  **Kiểm tra:** Người dùng quét mã QR để đối soát dữ liệu trực tiếp từ Smart Contract mà không cần qua Database.
---

## 🛠️ Công nghệ sử dụng

* **Ngôn ngữ:** JavaScript (ES6+), Solidity.
* **Frontend:** React, Vite, TailwindCSS, Ethers.js.
* **Backend:** Node.js, Express, Mongoose.
* **Database:** MongoDB Atlas (Cloud).
* **Blockchain:** Cronos Testnet, MetaMask, Remix IDE.

---

## 🔗 Thông tin triển khai

* **Smart Contract:** `0xc574902660D1A42bf9565c4033B08b4F52F9A6A4`
* **Mạng:** Cronos Testnet (Chain ID: 338).
* **Explorer:** [Cronos Scan Testnet](https://explorer.cronos.org/testnet)

---

## 💻 Hướng dẫn chạy môi trường Local

### 1. Backend
```bash
cd backend
npm install
npm start
Server mặc định chạy tại: http://localhost:5000

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
Ứng dụng mặc định chạy tại: http://localhost:5173

