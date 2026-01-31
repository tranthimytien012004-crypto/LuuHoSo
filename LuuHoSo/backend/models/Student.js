const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    walletAddress: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['student', 'school', 'company'], 
        default: 'student' 
    },
    records: [{
        fileName: String,
        fileHash: String,
        fileData: String,
        status: { 
            type: String, 
            enum: ['Đang chờ', 'Đã xác minh', 'Từ chối xác minh', 'Thu hồi'], 
            default: 'Đang chờ' 
        },
        verifiedBy: String,
        createdAt: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model("Student", StudentSchema);