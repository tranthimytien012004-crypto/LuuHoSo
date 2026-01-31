const express = require("express");
const router = express.Router();
const Student = require("../models/Student.js"); 

// --- 1. ĐĂNG NHẬP BẰNG VÍ ---
router.post("/wallet-login", async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ success: false, message: "Thiếu địa chỉ ví!" });

    try {
        let student = await Student.findOne({ 
            walletAddress: { $regex: new RegExp("^" + walletAddress + "$", "i") } 
        });

        if (!student) {
            student = new Student({
                email: `${walletAddress.substring(0, 6)}@blockchain.com`,
                walletAddress: walletAddress.toLowerCase(),
                role: 'student', 
                records: []
            });
            await student.save();
        }

        res.json({ success: true, user: student });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi đăng nhập: " + err.message });
    }
});

// --- 2. SINH VIÊN NỘP HỒ SƠ ---
router.post("/upload-record", async (req, res) => {
    const { walletAddress, fileName, fileHash, fileData } = req.body; 
    try {
        const student = await Student.findOneAndUpdate(
            { walletAddress: { $regex: new RegExp("^" + walletAddress + "$", "i") } },
            { 
                $push: { 
                    records: { fileName, fileHash, fileData, status: 'Pending', createdAt: new Date() } 
                } 
            },
            { new: true }
        );
        res.json({ success: true, message: "Hồ sơ đã được gửi!", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 3. LẤY DANH SÁCH CHỜ DUYỆT (Admin) ---
router.get("/pending-records", async (req, res) => {
    try {
        const students = await Student.find({ "records.status": "Pending" });
        const results = students.map(student => ({
            studentId: student._id,
            walletAddress: student.walletAddress,
            pendingRecords: student.records.filter(r => r.status === "Pending")
        }));
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi: " + err.message });
    }
});

// --- 4. NHÀ TRƯỜNG PHÊ DUYỆT ---
router.post("/verify-record", async (req, res) => {
    const { studentId, recordId, status, schoolWallet } = req.body;
    try {
        await Student.updateOne(
            { _id: studentId, "records._id": recordId },
            { 
                $set: { 
                    "records.$.status": status, 
                    "records.$.verifiedBy": schoolWallet,
                    "records.$.verifiedAt": new Date()
                } 
            }
        );
        res.json({ success: true, message: `Hồ sơ đã được ${status}!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 5. SINH VIÊN HỦY HỒ SƠ ---
router.delete("/cancel-record/:studentId/:recordId", async (req, res) => {
    try {
        const { studentId, recordId } = req.params;

        // Kiểm tra ID có hợp lệ không trước khi query
        if (!studentId || studentId === "undefined") {
            return res.status(400).json({ success: false, message: "Thiếu Student ID" });
        }

        await Student.findByIdAndUpdate(studentId, {
            $pull: { records: { _id: recordId } }
        });
        res.json({ success: true, message: "Đã hủy hồ sơ thành công" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + err.message });
    }
});
// --- 6. VÔ HIỆU HÓA HỒ SƠ (Nút mới) ---
router.post("/revoke-record", async (req, res) => {
    try {
        const { studentId, recordId } = req.body;
        await Student.updateOne(
            { _id: studentId, "records._id": recordId },
            { $set: { "records.$.status": "Revoked" } }
        );
        res.json({ success: true, message: "Hồ sơ đã bị vô hiệu hóa" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 7. LẤY DANH SÁCH ĐÃ DUYỆT (Gồm cả hồ sơ bị Vô hiệu hóa) ---
router.get("/approved-records", async (req, res) => {
    try {
        const students = await Student.find({ "records.status": { $in: ["Verified", "Revoked"] } });
        const results = students.map(s => ({
            studentId: s._id,
            walletAddress: s.walletAddress,
            approvedRecords: s.records.filter(r => ["Verified", "Revoked"].includes(r.status))
        }));
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;