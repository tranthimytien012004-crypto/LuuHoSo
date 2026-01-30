import { useState } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';

export default function UploadForm({ user }) {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Vui lòng chọn file!");

    const reader = new FileReader();
    reader.onload = async (e) => {
      // Băm nội dung file thành chuỗi SHA256
      const arrayBuffer = e.target.result;
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      const hash = CryptoJS.SHA256(wordArray).toString();

      try {
        await axios.post("http://localhost:5000/api/students/upload-record", {
          email: user.email,
          fileName: file.name,
          fileHash: hash
        });
        alert("Nộp hồ sơ thành công!");
      } catch (err) { alert("Lỗi gửi hồ sơ!"); }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px' }}>
      <h4>Nộp Hồ Sơ (Cấp bằng/Chứng chỉ)</h4>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} style={{ marginTop: '10px' }}>Gửi hồ sơ</button>
    </div>
  );
}