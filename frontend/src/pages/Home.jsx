import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; 
import axios from "axios";
import CryptoJS from 'crypto-js';
import { ethers } from "ethers";
import { QRCodeCanvas } from "qrcode.react";
import contractABI from "./ContractABI.json"; 

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [allStudents, setAllStudents] = useState([]); 
  const [approvedStudents, setApprovedStudents] = useState([]); 
  const [file, setFile] = useState(null);
  const [selectedQR, setSelectedQR] = useState(null);
  const [blockchainStatus, setBlockchainStatus] = useState({});

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/students";
  const CONTRACT_ADDRESS = "0xc574902660D1A42bf9565c4033B08b4F52F9A6A4";

  // --- 1. LOGIC BLOCKCHAIN: KIỂM TRA TRẠNG THÁI ---
  const checkBlockchainStatus = useCallback(async (records) => {
    if (!records || records.length === 0 || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
      const newStatuses = {};
      
      for (let rec of records) {
        if (rec.fileHash) {
          try {
            // Chuẩn hóa tuyệt đối: bỏ 0x cũ, viết thường, rồi thêm lại 0x chuẩn
            const cleanHash = rec.fileHash.replace("0x", "").toLowerCase().trim();
            const formattedHash = "0x" + cleanHash;

            const result = await contract.verifyRecord(formattedHash);
            
            // Gán kết quả vào cả 2 key để giao diện map kiểu gì cũng trúng
            newStatuses[rec.fileHash] = result[0];
            newStatuses[formattedHash] = result[0];
            
            console.log(`Check Blockchain: ${formattedHash} -> ${result[0]}`);
          } catch (e) {
            newStatuses[rec.fileHash] = false;
          }
        }
      }
      setBlockchainStatus(prev => ({ ...prev, ...newStatuses }));
    } catch (err) { 
      console.error("Blockchain Error:", err); 
    }
  }, [CONTRACT_ADDRESS]);

  // --- 2. FETCH DATA TỪ BACKEND ---
  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        axios.get(`${API_URL}/pending-records`),
        axios.get(`${API_URL}/approved-records`)
      ]);
      
      if (pendingRes.data.success) setAllStudents(pendingRes.data.data || []);
      
      if (approvedRes.data.success) {
        const approvedData = approvedRes.data.data || [];
        setApprovedStudents(approvedData);
        
        // Thu thập tất cả records để check blockchain một lượt
        const allApproved = approvedData.flatMap(std => std.approvedRecords);
        if (allApproved.length > 0) checkBlockchainStatus(allApproved);

        // Cập nhật thông tin sinh viên hiện tại
        const loggedInUser = JSON.parse(localStorage.getItem("user"));
        if (loggedInUser?.role === 'student') {
            const myId = loggedInUser._id || loggedInUser.id;
            const me = approvedData.find(s => s.studentId === myId || s._id === myId);
            if (me) {
                const updated = { ...loggedInUser, records: me.approvedRecords };
                setUser(updated);
                localStorage.setItem("user", JSON.stringify(updated));
            }
        }
      }
    } catch (err) { console.error("Fetch Error:", err); }
  }, [checkBlockchainStatus, API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 3. CÁC HÀM XỬ LÝ ---
  const handleViewFile = (base64Data, fileName) => {
    if (!base64Data) return alert("Không có dữ liệu tệp!");
    const newTab = window.open();
    const isImage = base64Data.includes("data:image");
    let content = isImage 
      ? `<img src="${base64Data}" style="max-width:100%; border-radius:8px;" />`
      : `<embed src="${base64Data}" width="100%" height="100%" type="application/pdf" />`;
    newTab.document.write(`<html><body style="margin:0; background:#0f172a; padding:20px; display:flex; flex-direction:column; align-items:center;"><h2 style="color:white;">${fileName}</h2>${content}</body></html>`);
  };

  const handleVerify = async (studentId, recordId, status) => {
    try {
      if (status === 'Verified') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        const student = allStudents.find(s => s.studentId === studentId || s._id === studentId);
        const record = student.pendingRecords.find(r => r._id === recordId);
        
        // Khi duyệt, ép hash về chữ thường + 0x để lưu lên Blockchain đồng nhất
        const finalHash = "0x" + record.fileHash.replace("0x", "").toLowerCase().trim();

        const tx = await contract.addRecord(finalHash, student.walletAddress || "0x0000000000000000000000000000000000000000");
        await tx.wait();
      }
      await axios.post(`${API_URL}/verify-record`, { studentId, recordId, status, schoolWallet: user.walletAddress });
      alert("Thao tác thành công!");
      fetchData();
    } catch (err) { alert("Lỗi: " + (err.reason || err.message)); }
  };

  const handleUpload = async () => {
    if (!file) return alert("Chọn file!");
    const reader = new FileReader();
    reader.onload = async (e) => {
      // Ép hash về chữ thường ngay từ khi nộp
      const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(await file.arrayBuffer())).toString().toLowerCase();
      try {
        await axios.post(`${API_URL}/upload-record`, {
          walletAddress: user.walletAddress, fileName: file.name, fileHash: hash, fileData: e.target.result 
        });
        alert("Nộp thành công!");
        fetchData();
      } catch (err) { alert("Lỗi nộp!"); }
    };
    reader.readAsDataURL(file);
  };

  const handleRevoke = async (studentId, recordId) => {
    if (!window.confirm("Vô hiệu hóa hồ sơ này?")) return;
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        const student = approvedStudents.find(s => s.studentId === studentId || s._id === studentId);
        const record = student.approvedRecords.find(r => r._id === recordId);
        const formattedHash = "0x" + record.fileHash.replace("0x", "").toLowerCase();

        const tx = await contract.revokeRecord(formattedHash);
        await tx.wait();
        await axios.post(`${API_URL}/revoke-record`, { studentId, recordId });
        fetchData();
    } catch (err) { alert("Lỗi thu hồi!"); }
  };

  return (
    <div style={contentWrapperStyle}>
      <div className="glass-card" style={cardStyle}>
        <h1 style={titleStyle}>🎓 QUẢN LÝ HỒ SƠ: {user?.role === 'school' ? 'NHÀ TRƯỜNG' : 'SINH VIÊN'}</h1>
        
        {/* VIEW SINH VIÊN */}
        {user?.role === 'student' && (
          <div style={statusBoxStyle}>
            <h3 style={{fontSize: '18px', color: 'white'}}>📤 Nộp Văn Bằng Mới</h3>
            <input type="file" accept="image/*, application/pdf" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0', display: 'block', color: 'white'}} />
            <button onClick={handleUpload} style={btnPrimary}>Băm & Gửi Hồ Sơ</button>
            
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tên văn bằng</th>
                  <th style={thStyle}>Trạng thái</th>
                  <th style={thStyle}>Xác thực Blockchain</th> 
                  <th style={thStyle}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(user.records || []).map((rec, index) => (
                  <tr key={index}>
                    <td style={tdStyle}>{rec.fileName}</td>
                    <td style={tdStyle}>
                      <span style={{color: rec.status === 'Verified' ? '#10b981' : '#f59e0b'}}>{rec.status}</span>
                    </td>
                    <td style={tdStyle}>
                      {(() => {
                  // Chuẩn hóa hash để tìm kiếm trong object blockchainStatus
                  const h = rec.fileHash.toLowerCase().trim();
                  const with0x = h.startsWith("0x") ? h : "0x" + h;
                  const without0x = h.replace("0x", "");

                  // Kiểm tra xem một trong các biến thể có đang là true không
                  if (blockchainStatus[h] || blockchainStatus[with0x] || blockchainStatus[without0x]) {
                  return <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '11px'}}>✅ ĐÃ XÁC THỰC</span>;
                }

                // Nếu chưa xác thực nhưng trạng thái DB là Verified thì báo đang đồng bộ
                return rec.status === 'Verified' ? (
                <small style={{color: '#94a3b8'}}>Đang đồng bộ...</small>
                      ) : (
                         <span style={{color: '#64748b'}}>-</span>
                  );
                  })()}
                    </td>
                    <td style={tdStyle}>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem👁️</button>
                        {rec.status === 'Verified' && (
                          <button 
                            onClick={() => {
                              const h = rec.fileHash.startsWith("0x") ? rec.fileHash : "0x" + rec.fileHash;
                              setSelectedQR(`${window.location.origin}/verify?hash=${h.toLowerCase()}`);
                            }}
                            style={{...btnViewSmall, background: '#10b981', color: 'white', border: 'none'}}
                          >
                            Mã QR
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW NHÀ TRƯỜNG */}
        {user?.role === 'school' && (
          <div style={statusBoxStyle}>
            <h3 style={{fontSize: '18px', color: '#60a5fa'}}>📝 Danh Sách Chờ Duyệt</h3>
            <table style={tableStyle}>
              <tbody>
                {allStudents.map(std => std.pendingRecords.map(rec => (
                  <tr key={rec._id}>
                    <td style={tdStyle}>{rec.fileName} <br/><small style={{color:'#64748b'}}>{std.email}</small></td>
                    <td style={tdStyle}>
                      <div style={{display: 'flex', gap: '10px'}}>
                        <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem👁️</button>
                        <button onClick={() => handleVerify(std.studentId, rec._id, 'Verified')} style={btnVerify}>Duyệt</button>
                        <button onClick={() => handleVerify(std.studentId, rec._id, 'Rejected')} style={btnReject}>Từ chối</button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>

            <h3 style={{fontSize: '18px', marginTop: '40px', color: '#10b981'}}>✅ Hồ Sơ Đã Phê Duyệt</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tên file</th>
                  <th style={thStyle}>Trạng thái Blockchain</th>
                  <th style={thStyle}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {approvedStudents.map(std => std.approvedRecords.map(rec => (
                  <tr key={rec._id}>
                    <td style={tdStyle}>{rec.fileName}</td>
                    <td style={tdStyle}>
                      {blockchainStatus[rec.fileHash] ? (
                        <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '11px'}}>✅ ĐÃ LƯU TRÊN BLOCKCHAIN</span>
                      ) : (
                        <span style={{color: '#ef4444', fontSize: '11px'}}>❌ CHƯA XÁC THỰC</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>🔍 Xem</button>
                        <button 
                          onClick={() => {
                            const h = rec.fileHash.startsWith("0x") ? rec.fileHash : "0x" + rec.fileHash;
                            setSelectedQR(`${window.location.origin}/verify?hash=${h.toLowerCase()}`);
                          }}
                          style={{...btnViewSmall, background: '#10b981', color: 'white', border: 'none'}}
                        >
                          📱 Hiện QR
                        </button>
                        <button onClick={() => handleRevoke(std.studentId, rec._id)} style={btnRevokeStyle}>Vô hiệu hóa</button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal QR */}
        {selectedQR && (
          <div style={modalOverlayStyle} onClick={() => setSelectedQR(null)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <h3 style={{color: '#1e293b', marginBottom: '10px'}}>Mã QR Xác Thực</h3>
              <div style={{background: 'white', padding: '15px', borderRadius: '10px', display: 'inline-block'}}>
                <QRCodeCanvas value={selectedQR} size={200} />
              </div>
              <p style={{fontSize: '12px', color: '#64748b', marginTop: '10px', wordBreak: 'break-all'}}>{selectedQR}</p>
              <button onClick={() => setSelectedQR(null)} style={{...btnPrimary, marginTop: '20px', width: '100%'}}>Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// STYLES (Giữ nguyên các styles cũ của ông bên dưới)
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#f8fafc', padding: '40px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '90%' };
const contentWrapperStyle = { width: '100%', display: 'flex', justifyContent: 'center', paddingTop: '40px' };
const cardStyle = { padding: '40px', width: '90%', maxWidth: '1100px', borderRadius: '24px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
const titleStyle = { fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '30px', textAlign: 'center' };
const statusBoxStyle = { width: '100%' };
const btnPrimary = { background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnVerify = { background: '#10b981', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const btnViewSmall = { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #60a5fa', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
const btnRevokeStyle = { background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 5px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '15px' };
const thStyle = { textAlign: 'left', padding: '12px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' };
const tdStyle = { padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '14px' };
const btnReject = { background: '#ef4444', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };