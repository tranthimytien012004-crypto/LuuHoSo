import fs from "fs";
import path from "path";

const dataPath = path.resolve("data/students.json");

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(path.dirname(dataPath))) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
}

// Lấy dữ liệu hiện tại
const readData = () => {
    if (!fs.existsSync(dataPath)) return [];
    try {
        const content = fs.readFileSync(dataPath, "utf8");
        return content ? JSON.parse(content) : [];
    } catch (error) {
        return [];
    }
};

// Ghi dữ liệu
const writeData = (data) => {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

// ----------------------
// 1. Sinh viên thêm hồ sơ (Mặc định là pending)
// ----------------------
export const addStudentRecord = (req, res) => {
    const { studentId, name, className } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "Bạn chưa upload file!" });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const database = readData();

    const newRecord = {
        id: Date.now(), // ID duy nhất để tìm kiếm sau này
        studentId,
        name,
        className,
        filePath,
        uploadedAt: new Date().toISOString(),
        status: "pending", // QUAN TRỌNG: Để Admin có thể lọc
    };

    database.push(newRecord);
    writeData(database);

    res.json({
        message: "Gửi hồ sơ thành công! Đang chờ Admin duyệt.",
        data: newRecord,
    });
};

// ----------------------
// 2. Lấy danh sách hồ sơ CHỜ DUYỆT (Cho Admin)
// ----------------------
export const getPendingRecords = (req, res) => {
    const database = readData();
    const pendingList = database.filter(item => item.status === "pending");
    res.json(pendingList);
};

// ----------------------
// 3. Admin Duyệt hồ sơ
// ----------------------
export const approveStudent = (req, res) => {
    const { id } = req.params; // Lấy ID hồ sơ từ URL
    let database = readData();

    const recordIndex = database.findIndex(item => item.id === parseInt(id));

    if (recordIndex === -1) {
        return res.status(404).json({ error: "Không tìm thấy hồ sơ!" });
    }

    // Cập nhật trạng thái
    database[recordIndex].status = "approved";
    database[recordIndex].approvedAt = new Date().toISOString();
    
    writeData(database);

    res.json({
        message: "Đã duyệt hồ sơ thành công!",
        data: database[recordIndex]
    });
};

// ----------------------
// 4. Lấy TOÀN BỘ hồ sơ (Đã duyệt và chưa duyệt)
// ----------------------
export const getAllStudents = (req, res) => {
    const database = readData();
    res.json(database);
};