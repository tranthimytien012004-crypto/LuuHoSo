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

  // --- 1. LOGIC BLOCKCHAIN (GIỮ NGUYÊN) ---
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

  // --- 2. FETCH DATA (GIỮ NGUYÊN) ---
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

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchData();
  }, [fetchData, navigate]);

  // --- 3. CÁC HÀM XỬ LÝ (GIỮ NGUYÊN) ---
  const handleViewFile = (base64Data, fileName) => {
    if (!base64Data) return alert("Không có dữ liệu tệp!");
    const newTab = window.open();
    const isImage = base64Data.includes("data:image");
    let content = isImage 
      ? `<img src="${base64Data}" style="max-width:100%; border-radius:8px;" />`
      : `<embed src="${base64Data}" width="100%" height="100%" type="application/pdf" />`;
    newTab.document.write(`<html><body style="margin:0; background:#0f172a; padding:20px; display:flex; flex-direction:column; align-items:center;"><h2 style="color:white; font-family:sans-serif;">${fileName}</h2>${content}</body></html>`);
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
    if (!file) return alert("Chọn file!");
    const reader = new FileReader();
    reader.onload = async (e) => {
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

  // --- 4. GIAO DIỆN (ĐÃ GẮN CLASS CSS) ---
  return (
    <div className="home-container">
      <div className="glass-card">
        <h1 style={titleStyle}>🎓 QUẢN LÝ HỒ SƠ: {user?.role === 'school' ? 'NHÀ TRƯỜNG' : 'SINH VIÊN'}</h1>
        <p style={{color: '#94a3b8', textAlign: 'center', marginBottom: '30px'}}>
          Người dùng: <b>{user?.username}</b> | Ví: {user?.walletAddress?.substring(0,6)}...
        </p>

        {user?.role === 'student' && (
          <div>
            <div style={{background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px dashed #334155', marginBottom: '25px'}}>
               <h3 style={{color: 'white', marginTop: 0}}>📤 Nộp Văn Bằng Mới</h3>
               <input type="file" accept="image/*, application/pdf" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0', display: 'block', color: 'white'}} />
               <button onClick={handleUpload} style={btnPrimary}>Băm & Gửi Hồ Sơ</button>
            </div>
            
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tên văn bằng</th>
                  <th>Trạng thái</th>
                  <th>Blockchain</th> 
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(user.records || []).map((rec, index) => (
                  <tr key={index}>
                    <td>{rec.fileName}</td>
                    <td>
                      <span className={`status-badge ${rec.status === 'Verified' ? 'status-verified' : 'status-pending'}`}>
                        {rec.status}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const h = rec.fileHash.toLowerCase().trim();
                        const with0x = h.startsWith("0x") ? h : "0x" + h;
                        if (blockchainStatus[h] || blockchainStatus[with0x]) {
                          return <span className="status-badge status-verified">✅ ĐÃ XÁC THỰC</span>;
                        }
                        return rec.status === 'Verified' ? <small style={{color: '#94a3b8'}}>Đang đồng bộ...</small> : <span style={{color: '#64748b'}}>-</span>;
                      })()}
                    </td>
                    <td>
                      <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem👁️</button>
                      {rec.status === 'Verified' && (
                         <button onClick={() => {
                           const h = rec.fileHash.startsWith("0x") ? rec.fileHash : "0x" + rec.fileHash;
                           setSelectedQR(`${window.location.origin}/verify?hash=${h.toLowerCase()}`);
                         }} style={{...btnViewSmall, background: '#10b981', color: 'white', marginLeft: '5px'}}>QR</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {user?.role === 'school' && (
          <div>
            <h3 style={{color: '#60a5fa', textAlign: 'left'}}>📝 Danh Sách Chờ Duyệt</h3>
            <table className="custom-table">
              <tbody>
                {allStudents.map(std => std.pendingRecords.map(rec => (
                  <tr key={rec._id}>
                    <td>{rec.fileName} <br/><small style={{color:'#64748b'}}>{std.email}</small></td>
                    <td>
                      <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem</button>
                      <button onClick={() => handleVerify(std.studentId, rec._id, 'Verified')} style={{...btnVerify, marginLeft: '5px'}}>Duyệt</button>
                      <button onClick={() => handleVerify(std.studentId, rec._id, 'Rejected')} style={{...btnReject, marginLeft: '5px'}}>Từ chối</button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>

            <h3 style={{color: '#10b981', textAlign: 'left', marginTop: '40px'}}>✅ Đã Phê Duyệt</h3>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tên file</th>
                  <th>Blockchain</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {approvedStudents.map(std => std.approvedRecords.map(rec => (
                  <tr key={rec._id}>
                    <td>{rec.fileName}</td>
                    <td>
                      {blockchainStatus[rec.fileHash] || blockchainStatus["0x"+rec.fileHash] 
                        ? <span className="status-badge status-verified">✅ ON-CHAIN</span>
                        : <span style={{color: '#ef4444'}}>❌ CHƯA LƯU</span>}
                    </td>
                    <td>
                      <button onClick={() => handleViewFile(rec.fileData, rec.fileName)} style={btnViewSmall}>Xem</button>
                      <button onClick={() => handleRevoke(std.studentId, rec._id)} style={{...btnRevokeStyle, marginLeft: '5px'}}>Vô hiệu</button>
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
              <h3 style={{color: '#1e293b'}}>Mã QR Xác Thực</h3>
              <QRCodeCanvas value={selectedQR} size={200} />
              <button onClick={() => setSelectedQR(null)} style={{...btnPrimary, marginTop: '20px', width: '100%', background: '#0f172a'}}>Đóng</button>
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
const titleStyle = { fontSize: '28px', fontWeight: '800', background: 'linear-gradient(90deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '30px', textAlign: 'center' };
const btnPrimary = { background: '#3b82f6', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const btnVerify = { background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' };
const btnViewSmall = { background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
const btnRevokeStyle = { background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' };
const btnReject = { background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' };