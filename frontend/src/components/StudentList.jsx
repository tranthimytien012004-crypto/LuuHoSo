import React, { useState, useEffect, useRef } from 'react';
import { verifyOnChain } from '../services/web3Service'; 
import { QRCodeCanvas } from 'qrcode.react';

export default function StudentList({ students }) {
  const [authStatus, setAuthStatus] = useState({});
  // Dùng Ref để ghi nhớ vĩnh viễn những ID đã xác thực xong trong phiên này
  const verifiedCache = useRef({});

  useEffect(() => {
    const checkAllRecords = async () => {
      if (!students || students.length === 0) return;

      for (let std of students) {
        const id = std._id || std.email;
        const record = std.records && std.records[0];

        // Chỉ kiểm tra nếu ID này chưa được xác thực thành công (VALID) trong Cache
        if (verifiedCache.current[id] !== "VALID" && record) {
          const hash = record.ipfsHash || record.hash;
          if (hash) {
            try {
              const isValid = await verifyOnChain(hash);
              if (isValid) {
                // Lưu vào Cache của Ref để không bao giờ bị reset khi re-render
                verifiedCache.current[id] = "VALID";
                
                // Cập nhật State theo kiểu "merge" (giữ lại cái cũ, thêm cái mới)
                setAuthStatus(prev => ({
                  ...prev,
                  [id]: "VALID"
                }));
              } else {
                setAuthStatus(prev => ({
                  ...prev,
                  [id]: "INVALID"
                }));
              }
            } catch (error) {
              console.error("Lỗi blockchain:", error);
            }
          }
        }
      }
    };

    checkAllRecords();
    // Chặn loop bằng cách không đưa authStatus vào dependency
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

  const handleCancel = async (studentId, recordId) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa hồ sơ nộp sai này không?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/cancel-record/${studentId}/${recordId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
          alert("✅ Đã hủy hồ sơ thành công!");
          window.location.reload(); 
        } else {
          alert("❌ Lỗi: " + data.message);
        }
      } catch (error) {
        alert("Không thể kết nối đến máy chủ!");
      }
    }
  };

  const handleRequestCancel = async (studentId, recordId) => {
    if (window.confirm("Hồ sơ đã được xác thực. Bạn muốn gửi yêu cầu thu hồi văn bằng này đến nhà trường?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/request-cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, recordId })
        });
        const data = await response.json();
        if (data.success) {
          alert("✅ Đã gửi yêu cầu hủy thành công.");
          window.location.reload();
        }
      } catch (error) {
        alert("Lỗi kết nối khi gửi yêu cầu!");
      }
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '10px' }}>
      <h3 style={{ marginBottom: '15px' }}>📜 Danh sách hồ sơ và văn bằng</h3>
      {students && students.length > 0 ? (
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f4f4' }}>
              <th style={{ padding: '12px' }}>Email / Thông tin</th>
              <th style={{ padding: '12px' }}>Ví (Wallet)</th>
              <th style={{ padding: '12px' }}>Văn bằng</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Trạng thái Blockchain</th> 
              <th style={{ padding: '12px', textAlign: 'center' }}>Mã QR</th>
              <th style={{ padding: '12px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {students.map((std, index) => {
              const id = std._id || std.email;
              // Ưu tiên lấy trạng thái từ Cache của Ref để không bị nhảy chữ
              const currentStatus = authStatus[id] || verifiedCache.current[id];
              const record = std.records && std.records[0];

              return (
                <tr key={index}>
                  <td style={{ padding: '10px' }}>{std.email}</td>
                  <td style={{ fontSize: '11px', padding: '10px', color: '#555' }}>{std.walletAddress}</td>
                  <td style={{ padding: '10px' }}>
                    <strong>{record?.fileName || 'Chưa có file'}</strong>
                  </td>
                  
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {record?.status === "Revoked" ? (
                      <b style={{ color: '#dc3545' }}>🚫 Đã thu hồi</b>
                    ) : currentStatus === "VALID" ? (
                      <b style={{ color: '#28a745' }}>✅ Đã xác thực</b>
                    ) : (
                      <span style={{ color: '#888' }}>⏳ Đang đồng bộ...</span>
                    )}
                  </td>

                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {record && (
                      <QRCodeCanvas 
                        value={`${window.location.origin}/verify/${id}`} 
                        size={60} 
                      />
                    )}
                  </td>

                  <td style={{ padding: '10px' }}>
                    <button 
                      onClick={() => handleVerify(record?.ipfsHash || record?.hash)}
                      style={{ 
                        cursor: record ? 'pointer' : 'not-allowed', 
                        backgroundColor: record ? '#4CAF50' : '#ccc', 
                        color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', marginRight: '5px' 
                      }}
                      disabled={!record}
                    >
                      🔍 Verify
                    </button>

                    {record && record.status !== "Revoked" && (
                      <button 
                        onClick={() => {
                          if (currentStatus === "VALID") {
                            handleRequestCancel(std._id, record._id);
                          } else {
                            handleCancel(std._id, record._id);
                          }
                        }}
                        disabled={record.status === "Request Cancel"}
                        style={{ 
                          cursor: record.status === "Request Cancel" ? 'not-allowed' : 'pointer', 
                          backgroundColor: record.status === "Request Cancel" ? '#6c757d' : (currentStatus === "VALID" ? '#ffc107' : '#dc3545'), 
                          color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px' 
                        }}
                      >
                        {record.status === "Request Cancel" 
                          ? '⏳ Đang chờ...' 
                          : (currentStatus === "VALID" ? '⚠️ Yêu cầu hủy' : '🗑️ Hủy')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Chưa có dữ liệu sinh viên nào.</div>
      )}
    </div>
  );
}