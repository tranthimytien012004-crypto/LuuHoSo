
const User = require('../models/User'); 

router.get('/student/:studentId', async (req, res) => {
  try {

    const student = await User.findById(req.params.studentId);

    if (!student) {
      return res.status(404).json({ message: "Không tìm thấy sinh viên" });
    }
    res.json(student.records || []); 
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi truy xuất dữ liệu từ server" });
  }
});