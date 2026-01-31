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

  // --- THÔNG TIN SMART CONTRACT ---
  const CONTRACT_ADDRESS = "0xc574902660D1A42bf9565c4033B08b4F52F9A6A4";

  // --- LOGIC BLOCKCHAIN 1: KIỂM TRA TRẠNG THÁI ON-CHAIN (READ ONLY) ---
  const checkBlockchainStatus = useCallback(async (records) => {
    if (!records || records.length === 0 || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      // Kết nối với Contract bằng Provider (Chế độ đọc - không tốn phí)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
      const statuses = { ...blockchainStatus };

      for (let rec of records) {
        if (rec.fileHash) {
          try {
            // Gọi hàm verifyRecord từ Smart Contract (trả về: isValid, studentWallet, timestamp)
            const result = await contract.verifyRecord(rec.fileHash);
            // result[0] tương ứng với biến 'isValid' (kiểu bool) trong Struct Record của Solidity
            statuses[rec.fileHash] = result[0]; 
          } catch (e) {
            statuses[rec.fileHash] = false;
          }
        }
      }
      setBlockchainStatus(statuses);
    } catch (err) {
      console.error("Lỗi kiểm tra Blockchain:", err);
    }
  }, [blockchainStatus]);

  const fetchData = async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        axios.get("http://localhost:5000/api/students/pending-records"),
        axios.get("http://localhost:5000/api/students/approved-records")
      ]);
      if (pendingRes.data.success) setAllStudents(pendingRes.data.data || []);
      if (approvedRes.data.success) {
          const approvedData = approvedRes.data.data || [];
          setApprovedStudents(approvedData);
          
          // Sau khi lấy dữ liệu từ Backend, tự động kiểm tra xem chúng có trên Blockchain không
          const allApproved = approvedData.flatMap(std => std.approvedRecords);
          checkBlockchainStatus(allApproved);
      }
    } catch (err) { console.error("Lỗi fetch data:", err); }
  };

  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem("user"));
    setUser(loggedInUser);
    if (loggedInUser?.role === 'school') { 
      fetchData(); 
    }
    if (loggedInUser?.role === 'student' && loggedInUser.records) {
      checkBlockchainStatus(loggedInUser.records);
    }
  }, []);

  // --- LOGIC BLOCKCHAIN 2: THU HỒI HỒ SƠ (WRITE - TỐN GAS) ---
  const handleRevoke = async (studentId, recordId) => {
    if (window.confirm("CẢNH BÁO: Bạn đang vô hiệu hóa hồ sơ này trên Blockchain. Tiếp tục?")) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(); // Cần chữ ký của Nhà trường (Admin)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        
        const student = approvedStudents.find(s => s.studentId === studentId);
        const record = student.approvedRecords.find(r => r._id === recordId);

        // Thực thi hàm revokeRecord trên Smart Contract để hủy tính hợp lệ của mã băm
        const tx = await contract.revokeRecord(record.fileHash);
        await tx.wait(); // Đợi giao dịch được xác thực bởi mạng lưới (Miner)

        // Cập nhật Database Backend sau khi Blockchain đã xác nhận
        const res = await axios.post("http://localhost:5000/api/students/revoke-record", { studentId, recordId });
        if (res.data.success) {
          alert("Hồ sơ đã bị vô hiệu hóa!");
          fetchData();
        }
      } catch (err) { 
        alert("Lỗi khi vô hiệu hóa: " + (err.reason || err.message)); 
      }
    }
  };

  // --- LOGIC BLOCKCHAIN 3: DUYỆT & LƯU HỒ SƠ (WRITE - TỐN GAS) ---
  const handleVerify = async (studentId, recordId, status) => {
    try {
      if (status === 'Verified') {
        if (!window.ethereum) return alert("Vui lòng cài đặt MetaMask!");
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(); // Nhà trường ký xác nhận
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

        const student = allStudents.find(s => s.studentId === studentId);
        const record = student.pendingRecords.find(r => r._id === recordId);

        // Gọi hàm addRecord để lưu fileHash và ví sinh viên lên Blockchain
        const tx = await contract.addRecord(record.fileHash, student.walletAddress);
        await tx.wait(); // Chờ giao dịch hoàn tất trên mạng lưới
        alert("✅ Đã xác thực lên Blockchain Cronos!");
      }

      // Sau khi Blockchain ok, gọi API cập nhật trạng thái hồ sơ trong Database
      await axios.post("http://localhost:5000/api/students/verify-record", {
        studentId, recordId, status, schoolWallet: user.walletAddress
      });
      fetchData();
    } catch (err) {
      alert("Lỗi: " + (err.reason || err.message)); 
    }
  };

  // --- LOGIC ỨNG DỤNG THÔNG THƯỜNG ---
  const handleUpload = async () => {
    if (!file) return alert("Vui lòng chọn file!");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fullBase64 = e.target.result;
      const arrayBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      const hash = CryptoJS.SHA256(wordArray).toString(); // Băm file sang SHA-256
      try {
        await axios.post("http://localhost:5000/api/students/upload-record", {
          walletAddress: user.walletAddress, 
          fileName: file.name,
          fileHash: hash,
          fileData: fullBase64 
        });
        alert("Nộp hồ sơ thành công!");
        window.location.reload(); 
      } catch (err) { alert("Lỗi nộp hồ sơ!"); }
    };
    reader.readAsDataURL(file);
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-gen");
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `Văn-bằng-Blockchain.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCancel = async (recordId) => {
    const studentId = user?._id || user?.id; 
    if (!studentId) return alert("Không tìm thấy ID sinh viên!");
    if (!window.confirm("Bạn có chắc chắn muốn hủy hồ sơ này?")) return;
    try {
      const response = await fetch(`http://localhost:5000/api/students/cancel-record/${studentId}/${recordId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        alert("Đã hủy hồ sơ!");
        window.location.reload();
      }
    } catch (error) { alert("Lỗi kết nối!"); }
  };

  const handleViewFile = (base64Data, fileName) => {
    if (!base64Data) return alert("Hồ sơ này không có dữ liệu tệp!");
    const newTab = window.open();
    const isImage = base64Data.includes("data:image");
    let content = isImage 
      ? `<img src="${base64Data}" style="max-width:100%; height:auto; border-radius:8px;" />`
      : `<embed src="${base64Data.includes('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`}" width="100%" height="100%" type="application/pdf" />`;
    newTab.document.write(`<html><body style="margin:0; background:#0f172a; padding:20px; display:flex; flex-direction:column; align-items:center;"><h2 style="color:white;">${fileName}</h2>${content}</body></html>`);
  };

  // --- GIAO DIỆN (UI) ---
  if (!user) {
    return (
      <div style={welcomeContainerStyle}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');`}</style>
        <div style={welcomeContentStyle}>
          <div style={badgeStyle}>BLOCKCHAIN PLATFORM</div>
          <h1 style={welcomeTitleStyle}>Nền tảng lưu trữ và xác thực hồ sơ <br /><span style={{ color: '#60a5fa', fontWeight: '800' }}>Blockchain An Toàn & Minh Bạch</span></h1>
          <p style={descriptionStyle}>Giải pháp ứng dụng <strong>Blockchain</strong> giúp lưu trữ, xác thực và bảo vệ hồ sơ số.</p>
          <button onClick={() => navigate("/dashboard")} style={loginButtonStyle}>Truy cập hệ thống</button>
        </div>
      </div>
    );
  }

  return (
    <div style={contentWrapperStyle}>
      <div className="glass-card" style={cardStyle}>
        <h1 style={titleStyle}>🎓 QUẢN LÝ HỒ SƠ: {user?.role === 'school' ? 'NHÀ TRƯỜNG' : 'SINH VIÊN'}</h1>
        
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
                {user.records?.map((rec, index) => (
                  <tr key={index}>
                    <td style={tdStyle}>{rec.fileName}</td>
                    <td style={tdStyle}>{rec.status}</td>
                    <td style={tdStyle}>
                        {blockchainStatus[rec.fileHash] ? (
                            <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '12px'}}>✅ ĐÃ LƯU TRÊN BLOCKCHAIN</span>
                        ) : (
                            rec.status === 'Verified' ? <small style={{color: '#94a3b8'}}>Đang đồng bộ...</small> : "-"
                        )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem👁️</button>
                        {rec.status === 'Verified' && (
                          <button 
                            onClick={() => setSelectedQR(`http://192.168.1.118:5173/verify?hash=${rec.fileHash}`)}
                            style={{...btnViewSmall, background: '#10b981', color: 'white', border: 'none'}}
                          >
                            Mã QR
                          </button>
                        )}
                        {rec.status === 'Pending' && <button onClick={() => handleCancel(rec._id)} style={btnCancel}>🗑️ Hủy</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {user?.role === 'school' && (
          <div style={statusBoxStyle}>
            <h3 style={{fontSize: '18px', marginBottom: '15px', color: '#60a5fa'}}>📝 Danh Sách Chờ Duyệt</h3>
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
                            <span style={{
                                background: 'rgba(16, 185, 129, 0.15)', 
                                color: '#10b981', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px',
                                fontWeight: 'bold'
                            }}>
                                ✅ ĐÃ LƯU TRÊN BLOCKCHAIN
                            </span>
                        ) : (
                            <span style={{color: '#ef4444', fontSize: '11px', fontWeight: 'bold'}}>❌ ĐÃ THU HỒI / CHƯA XÁC THỰC</span>
                        )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>🔍 Xem lại</button>
                        <button 
                          onClick={() => setSelectedQR(`http://192.168.1.118:5173/verify?hash=${rec.fileHash}`)}
                          style={{...btnViewSmall, background: '#10b981', color: 'white', border: 'none'}}
                        >
                          📱 Hiện QR
                        </button>
                        {rec.status === 'Verified' && <button onClick={() => handleRevoke(std.studentId, rec._id)} style={btnRevokeStyle}>Vô hiệu hóa</button>}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {selectedQR && (
          <div style={modalOverlayStyle} onClick={() => setSelectedQR(null)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <h3 style={{color: '#1e293b', marginBottom: '10px'}}>Mã QR Xác Thực Blockchain</h3>
              <p style={{fontSize: '12px', color: '#64748b', marginBottom: '20px'}}>Sử dụng điện thoại để quét và kiểm tra tính hợp lệ</p>
              <div style={{background: 'white', padding: '15px', borderRadius: '10px', display: 'inline-block'}}>
                <QRCodeCanvas id="qr-gen" value={selectedQR} size={200} level="H" includeMargin={true} />
              </div>
              <div style={{marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
                <button onClick={downloadQRCode} style={{...btnPrimary, background: '#10b981'}}>Tải mã QR ↓</button>
                <button onClick={() => setSelectedQR(null)} style={{...btnPrimary, background: '#64748b'}}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- CSS STYLES ---
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#f8fafc', padding: '40px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '90%' };
const welcomeContainerStyle = { width: '100%', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" };
const welcomeContentStyle = { maxWidth: '850px', padding: '0 20px' };
const badgeStyle = { color: '#60a5fa', letterSpacing: '2px', fontSize: '12px', fontWeight: '700', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.1)', display: 'inline-block', padding: '5px 15px', borderRadius: '20px' };
const welcomeTitleStyle = { fontSize: '42px', color: 'white', fontWeight: '800', marginBottom: '20px', lineHeight: '1.2' };
const descriptionStyle = { color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6', maxWidth: '620px', margin: '0 auto 30px auto' };
const loginButtonStyle = { background: '#3b82f6', color: 'white', padding: '16px 40px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontSize: '16px' };
const contentWrapperStyle = { width: '100%', display: 'flex', justifyContent: 'center', paddingTop: '40px' };
const cardStyle = { padding: '40px', width: '90%', maxWidth: '1100px', borderRadius: '24px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
const titleStyle = { fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '30px', textAlign: 'center' };
const statusBoxStyle = { width: '100%' };
const btnPrimary = { background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnVerify = { background: '#10b981', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const btnViewSmall = { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #60a5fa', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
const btnCancel = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' };
const btnRevokeStyle = { background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 5px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '15px' };
const thStyle = { textAlign: 'left', padding: '12px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' };
const tdStyle = { padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '14px' };
const btnReject = { background: '#ef4444', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };