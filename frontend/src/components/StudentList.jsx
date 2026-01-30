import React, { useState, useEffect } from 'react';
import { verifyOnChain } from '../services/web3Service'; 

export default function StudentList({ students }) {
  // THÊM MỚI: State để lưu kết quả xác thực tự động
  const [authStatus, setAuthStatus] = useState({});

  // THÊM MỚI: Hàm tự động kiểm tra khi danh sách students thay đổi
  useEffect(() => {
    const checkAllRecords = async () => {
      if (students && students.length > 0) {
        const results = { ...authStatus };
        for (let std of students) {
          if (std.records && std.records[0]) {
            const hash = std.records[0].ipfsHash || std.records[0].hash;
            if (hash) {
              const isValid = await verifyOnChain(hash);
              results[std._id || std.email] = isValid ? "VALID" : "INVALID";
            }
          }
        }
        setAuthStatus(results);
      }
    };
    checkAllRecords();
  }, [students]);

  const handleVerify = async (hash) => {
    if (!hash) {
      alert("Văn bằng này không có mã băm (Hash) để kiểm tra!");
      return;
    }
    const isValid = await verifyOnChain(hash);
    if (isValid) {
      alert("✅ Xác thực thành công! Văn bằng này hợp lệ trên Blockchain.");
    } else {
      alert("❌ Cảnh báo: Không tìm thấy mã băm này trên hệ thống Blockchain!");
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '10px' }}>
      <h3>Danh sách hồ sơ và văn bằng</h3>
      {students && students.length > 0 ? (
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee' }}>
              <th style={{ padding: '10px' }}>Email</th>
              <th style={{ padding: '10px' }}>Ví (Wallet)</th>
              <th style={{ padding: '10px' }}>Văn bằng đã nộp</th>
              {/* GIỮ NGUYÊN CŨ, CHỈ THÊM MỚI CỘT NÀY */}
              <th style={{ padding: '10px' }}>Trạng thái Blockchain</th> 
              <th style={{ padding: '10px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {students.map((std, index) => (
              <tr key={index}>
                <td style={{ padding: '10px' }}>{std.email}</td>
                <td style={{ fontSize: '12px', padding: '10px' }}>{std.walletAddress}</td>
                <td style={{ padding: '10px' }}>
                  {std.records && std.records.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                      {std.records.map((rec, i) => (
                        <li key={i} style={{ marginBottom: '5px' }}>
                          <strong>{rec.studentName || 'Bản ghi ' + (i + 1)}</strong> 
                          <br />
                          <span style={{ fontSize: '11px', color: '#666' }}>
                            Loại: {rec.documentType || 'N/A'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: 'gray' }}>Chưa có bản ghi</span>
                  )}
                </td>
                
                {/* THÊM MỚI: Cột hiển thị trạng thái tự động */}
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  {authStatus[std._id || std.email] === "VALID" ? (
                    <b style={{ color: '#28a745' }}>✅ Đã lưu On-chain</b>
                  ) : authStatus[std._id || std.email] === "INVALID" ? (
                    <b style={{ color: '#dc3545' }}>❌ Chưa xác thực</b>
                  ) : (
                    <span style={{ color: '#888' }}>⏳ Đang kiểm tra...</span>
                  )}
                </td>

                <td style={{ padding: '10px' }}>
                  <button 
                    onClick={() => handleVerify(std.records[0]?.ipfsHash || std.records[0]?.hash)}
                    style={{ 
                      cursor: 'pointer', 
                      backgroundColor: (std.records && std.records.length > 0) ? '#4CAF50' : '#ccc', 
                      color: 'white', 
                      border: 'none', 
                      padding: '5px 10px', 
                      borderRadius: '4px' 
                    }}
                    disabled={!std.records || std.records.length === 0}
                  >
                    🔍 Verify Blockchain
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Chưa có dữ liệu sinh viên nào.</p>
      )}
    </div>
  );
}