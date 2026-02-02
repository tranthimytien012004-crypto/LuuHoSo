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

  const API_URL = import.meta.env.VITE_API_URL || "https://luuhoso.onrender.com/api/students";
  const CONTRACT_ADDRESS = "0xc574902660D1A42bf9565c4033B08b4F52F9A6A4";

  // --- LOGIC BLOCKCHAIN & FETCH DATA (Giữ nguyên của ông) ---
  const checkBlockchainStatus = useCallback(async (records) => {
    if (!records || records.length === 0 || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
      const newStatuses = {};
      for (let rec of records) {
        if (rec.fileHash) {
          try {
            const cleanHash = rec.fileHash.replace("0x", "").toLowerCase().trim();
            const formattedHash = "0x" + cleanHash;
            const result = await contract.verifyRecord(formattedHash);
            newStatuses[rec.fileHash] = result[0];
            newStatuses[formattedHash] = result[0];
          } catch (e) { newStatuses[rec.fileHash] = false; }
        }
      }
      setBlockchainStatus(prev => ({ ...prev, ...newStatuses }));
    } catch (err) { console.error("Blockchain Error:", err); }
  }, [CONTRACT_ADDRESS]);

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
        const allApproved = approvedData.flatMap(std => std.approvedRecords);
        if (allApproved.length > 0) checkBlockchainStatus(allApproved);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- CÁC HÀM XỬ LÝ (Giữ nguyên logic cũ) ---
  const handleViewFile = (base64Data, fileName) => {
    if (!base64Data) return alert("Không có dữ liệu tệp!");
    const newTab = window.open();
    const isImage = base64Data.includes("data:image");
    let content = isImage 
      ? `<img src="${base64Data}" style="max-width:100%; border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />`
      : `<embed src="${base64Data}" width="100%" height="100%" type="application/pdf" />`;
    newTab.document.write(`<html><body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;"><div style="text-align:center;"><h2 style="color:white; margin-bottom:20px;">${fileName}</h2>${content}</div></body></html>`);
  };

  const handleVerify = async (studentId, recordId, status) => {
    try {
      if (status === 'Verified') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        const student = allStudents.find(s => s.studentId === studentId || s._id === studentId);
        const record = student.pendingRecords.find(r => r._id === recordId);
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
    if (!file) return alert("Vui lòng chọn file!");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(await file.arrayBuffer())).toString().toLowerCase();
      try {
        await axios.post(`${API_URL}/upload-record`, {
          walletAddress: user.walletAddress, fileName: file.name, fileHash: hash, fileData: e.target.result 
        });
        alert("Nộp thành công!");
        setFile(null);
        fetchData();
      } catch (err) { alert("Lỗi nộp hồ sơ!"); }
    };
    reader.readAsDataURL(file);
  };

  const handleRevoke = async (studentId, recordId) => {
    if (!window.confirm("Vô hiệu hóa hồ sơ này vĩnh viễn?")) return;
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
    <div style={homeContainerStyle}>
      <div style={glassCardStyle}>
        <div style={badgeStyle}>Cronos Blockchain Network</div>
        <h1 style={titleStyle}>🎓 QUẢN LÝ HỒ SƠ: {user?.role === 'school' ? 'NHÀ TRƯỜNG' : 'SINH VIÊN'}</h1>
        <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '15px' }}>
          Hệ thống lưu trữ và xác thực văn bằng minh bạch trên nền tảng Web3.
        </p>
        
        {/* VIEW SINH VIÊN */}
        {user?.role === 'student' && (
          <div style={statusBoxStyle}>
            <div style={uploadAreaStyle}>
               <h3 style={{fontSize: '18px', color: 'white', marginBottom: '15px'}}>📤 Nộp Văn Bằng Mới</h3>
               <input type="file" accept="image/*, application/pdf" onChange={(e) => setFile(e.target.files[0])} style={fileInputStyle} />
               <button onClick={handleUpload} style={btnPrimary}>Băm & Gửi Hồ Sơ Lên Hệ Thống</button>
            </div>
            
            <h3 style={{fontSize: '18px', color: '#60a5fa', textAlign: 'left', marginTop: '30px'}}>📋 Lịch sử gửi hồ sơ</h3>
            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                <thead>
                    <tr>
                    <th style={thStyle}>Tên văn bằng</th>
                    <th style={thStyle}>Trạng thái</th>
                    <th style={thStyle}>Blockchain</th> 
                    <th style={thStyle}>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {(user.records || []).map((rec, index) => (
                    <tr key={index} style={trStyle}>
                        <td style={tdStyle}>{rec.fileName}</td>
                        <td style={tdStyle}>
                        <span style={{...statusBadge, background: rec.status === 'Verified' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: rec.status === 'Verified' ? '#10b981' : '#f59e0b'}}>
                            {rec.status}
                        </span>
                        </td>
                        <td style={tdStyle}>
                        {(() => {
                            const h = rec.fileHash.toLowerCase().trim();
                            const with0x = h.startsWith("0x") ? h : "0x" + h;
                            if (blockchainStatus[h] || blockchainStatus[with0x]) {
                                return <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '11px'}}>✅ ĐÃ XÁC THỰC</span>;
                            }
                            return rec.status === 'Verified' ? <small style={{color: '#94a3b8'}}>Đang đồng bộ...</small> : <span style={{color: '#64748b'}}>-</span>;
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
          </div>
        )}

        {/* VIEW NHÀ TRƯỜNG */}
        {user?.role === 'school' && (
          <div style={statusBoxStyle}>
            <h3 style={{fontSize: '18px', color: '#60a5fa', textAlign: 'left'}}>📝 Danh Sách Chờ Duyệt</h3>
            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                <tbody>
                    {allStudents.map(std => std.pendingRecords.map(rec => (
                    <tr key={rec._id} style={trStyle}>
                        <td style={tdStyle}>{rec.fileName} <br/><small style={{color:'#64748b'}}>{std.email}</small></td>
                        <td style={tdStyle}>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem👁️</button>
                            <button onClick={() => handleVerify(std.studentId, rec._id, 'Verified')} style={btnVerify}>Duyệt ✅</button>
                            <button onClick={() => handleVerify(std.studentId, rec._id, 'Rejected')} style={btnReject}>Từ chối</button>
                        </div>
                        </td>
                    </tr>
                    )))}
                </tbody>
                </table>
            </div>

            <h3 style={{fontSize: '18px', marginTop: '40px', color: '#10b981', textAlign: 'left'}}>✅ Hồ Sơ Đã Phê Duyệt</h3>
            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                <thead>
                    <tr>
                    <th style={thStyle}>Tên hồ sơ</th>
                    <th style={thStyle}>Blockchain Status</th>
                    <th style={thStyle}>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {approvedStudents.map(std => std.approvedRecords.map(rec => (
                    <tr key={rec._id} style={trStyle}>
                        <td style={tdStyle}>{rec.fileName}</td>
                        <td style={tdStyle}>
                        {blockchainStatus[rec.fileHash] ? (
                            <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '11px'}}>✅ ON-CHAIN SUCCESS</span>
                        ) : (
                            <span style={{color: '#ef4444', fontSize: '11px'}}>❌ CHƯA ĐỒNG BỘ</span>
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
                            📱 Mã QR
                            </button>
                            <button onClick={() => handleRevoke(std.studentId, rec._id)} style={btnRevokeStyle}>Vô hiệu hóa</button>
                        </div>
                        </td>
                    </tr>
                    )))}
                </tbody>
                </table>
            </div>
          </div>
        )}

        {/* Modal QR (Glassmorphism) */}
        {selectedQR && (
          <div style={modalOverlayStyle} onClick={() => setSelectedQR(null)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <h3 style={{color: '#1e293b', marginBottom: '15px', fontWeight: '800'}}>QR CODE XÁC THỰC</h3>
              <div style={{background: 'white', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'}}>
                <QRCodeCanvas value={selectedQR} size={220} />
              </div>
              <p style={{fontSize: '11px', color: '#94a3b8', marginTop: '15px', wordBreak: 'break-all', padding: '0 20px'}}>{selectedQR}</p>
              <button onClick={() => setSelectedQR(null)} style={{...btnPrimary, marginTop: '25px', width: '80%', borderRadius: '100px'}}>ĐÓNG CỬA SỔ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- HỆ THỐNG STYLE  (GLASSMORPHISM) ---
const homeContainerStyle = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top right, #1e293b, #0f172a)', 
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: 'white',
  padding: '40px 20px',
  display: 'flex',
  justifyContent: 'center'
};

const glassCardStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(15px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '32px',
  padding: '50px 40px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  maxWidth: '1100px',
  width: '100%',
  textAlign: 'center'
};

const titleStyle = {
  fontSize: '32px',
  fontWeight: '800',
  letterSpacing: '-1px',
  background: 'linear-gradient(90deg, #60a5fa, #c084fc)', 
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  marginBottom: '10px',
  fontFamily: 'inherit'
};

const badgeStyle = {
  background: 'rgba(96, 165, 250, 0.1)',
  color: '#60a5fa',
  padding: '6px 18px',
  borderRadius: '100px',
  fontSize: '11px',
  fontWeight: '700',
  display: 'inline-block',
  marginBottom: '20px',
  textTransform: 'uppercase',
  border: '1px solid rgba(96, 165, 250, 0.2)'
};

const uploadAreaStyle = {
  background: 'rgba(255,255,255,0.02)',
  padding: '30px',
  borderRadius: '20px',
  border: '1px dashed rgba(255,255,255,0.1)',
  marginBottom: '40px'
};

const fileInputStyle = {
  margin: '20px auto',
  display: 'block',
  padding: '10px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '8px',
  fontSize: '13px'
};

const tableWrapperStyle = {
  overflowX: 'auto',
  marginTop: '15px',
  background: 'rgba(0,0,0,0.1)',
  borderRadius: '16px',
  padding: '10px'
};

const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' };
const thStyle = { textAlign: 'left', padding: '15px', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' };
const trStyle = { background: 'rgba(255,255,255,0.02)', borderRadius: '12px' };
const tdStyle = { padding: '15px', color: '#e2e8f0', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.02)' };

const statusBadge = { padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' };

const btnPrimary = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', padding: '12px 28px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', transition: '0.3s' };
const btnVerify = { background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' };
const btnReject = { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' };
const btnViewSmall = { background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', transition: '0.2s' };
const btnRevokeStyle = { background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' };

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#ffffff', padding: '40px', borderRadius: '32px', textAlign: 'center', maxWidth: '420px', width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' };