import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ethers } from "ethers";
import contractABI from "./ContractABI.json"; 

export default function Verify() {
  const [searchParams] = useSearchParams();
  const rawFileHash = searchParams.get("hash"); // Lấy mã hash từ URL (do QR quét ra)
  const [status, setStatus] = useState("loading"); 
  const [recordInfo, setRecordInfo] = useState(null);

  // --- THÔNG TIN SMART CONTRACT ---
  const CONTRACT_ADDRESS = "0xc574902660D1A42bf9565c4033B08b4F52F9A6A4";

  useEffect(() => {
    if (rawFileHash) {
      checkBlockchain();
    } else {
      setStatus("invalid");
    }
  }, [rawFileHash]);

 const checkBlockchain = async () => {
    try {
      // 1. Kết nối tới Cronos Testnet RPC
      const provider = new ethers.JsonRpcProvider("https://evm-t3.cronos.org");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
      
      // 2. CHUẨN HÓA HASH TUYỆT ĐỐI: Bỏ 0x cũ -> viết thường -> thêm 0x chuẩn
      // Việc này đảm bảo hash luôn đúng định dạng bytes32 mà Contract yêu cầu
      let cleanHash = rawFileHash.trim().replace("0x", "").toLowerCase();
      const formattedHash = "0x" + cleanHash;
      
      console.log("🔍 Đang truy vấn Blockchain cho Hash:", formattedHash);

      // 3. Gọi hàm verifyRecord
      const record = await contract.verifyRecord(formattedHash);
      
      console.log("📦 Kết quả từ Contract:", record);

      // record[0] là isValid (bool)
      if (record && record[0] === true) {
        setRecordInfo({
          student: record[1], // Địa chỉ ví sinh viên
          timestamp: Number(record[2]), // Unix timestamp
          txHash: formattedHash
        });
        setStatus("valid");
      } else {
        const recordRetry = await contract.verifyRecord(rawFileHash.trim());
        if (recordRetry && recordRetry[0] === true) {
             setRecordInfo({
                student: recordRetry[1],
                timestamp: Number(recordRetry[2]),
                txHash: rawFileHash.trim()
             });
             setStatus("valid");
        } else {
            setStatus("invalid");
        }
      }
    } catch (err) {
      console.error("❌ Lỗi tra cứu Blockchain:", err);
      setStatus("error");
    }
  };

  return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');`}</style>
      
      <div style={cardStyle}>
        <div style={badgeStyle}>HỆ THỐNG XÁC THỰC BLOCKCHAIN</div>
        <h2 style={titleStyle}>KẾT QUẢ KIỂM TRA</h2>
        
        <div style={infoBoxStyle}>
          <p style={labelStyle}>Mã băm hồ sơ (File Hash):</p>
          <code style={hashStyle}>{rawFileHash}</code>
        </div>

        <hr style={dividerStyle} />

        {status === "loading" && (
          <div style={{color: '#60a5fa'}}>🔄 Đang truy vấn dữ liệu từ Cronos Testnet...</div>
        )}

        {status === "valid" && (
          <div>
            <div style={successBoxStyle}>
              <h1 style={{margin: 0, fontSize: '40px'}}>✅</h1>
              <h2 style={{color: '#10b981', marginTop: '10px'}}>VĂN BẰNG HỢP LỆ</h2>
              <p style={{color: '#e5e7eb', fontSize: '14px'}}>Thông tin đã đối soát khớp 100% với dữ liệu gốc trên Blockchain.</p>
            </div>
            
            <div style={detailsStyle}>
              <p style={{marginBottom: '8px'}}>📍 <strong>Ví sinh viên:</strong></p>
              <small style={{color: '#60a5fa', wordBreak: 'break-all'}}>{recordInfo?.student}</small>
              
              <p style={{marginTop: '15px', marginBottom: '8px'}}>📅 <strong>Thời gian xác thực:</strong></p>
              <small style={{color: '#e5e7eb'}}>{new Date(recordInfo?.timestamp * 1000).toLocaleString()}</small>

              {/* NÚT KIỂM TRA TRỰC TIẾP TRÊN EXPLORER */}
              <a 
                href={`https://explorer.cronos.org/testnet/address/${CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noreferrer"
                style={cronosButtonStyle}
              >
                🔍 Xem bằng chứng trên Cronos Explorer
              </a>

              <p style={{marginTop: '15px', fontSize: '11px', color: '#94a3b8', textAlign: 'center'}}>
                🛡️ Trạng thái: <strong>Vĩnh viễn / Không thể sửa đổi</strong>
              </p>
            </div>
          </div>
        )}

        {status === "invalid" && (
          <div style={errorBoxStyle}>
            <h1 style={{margin: 0, fontSize: '40px'}}>❌</h1>
            <h2 style={{color: '#ef4444', marginTop: '10px'}}>KHÔNG TÌM THẤY DỮ LIỆU</h2>
            <p style={{color: '#e5e7eb', fontSize: '14px'}}>Cảnh báo: Mã băm này chưa được đăng ký hoặc đã bị nhà trường thu hồi.</p>
          </div>
        )}

        {status === "error" && (
          <div style={{padding: '15px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px'}}>
            <p style={{color: '#f59e0b', margin: 0}}>⚠️ Hệ thống không thể kết nối với Blockchain. Vui lòng kiểm tra lại mạng.</p>
          </div>
        )}

        <button onClick={() => window.location.href='/'} style={backButtonStyle}>Quay lại trang chủ</button>
      </div>
    </div>
  );
}

// --- CSS STYLES ---
const containerStyle = { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '20px' };
const cardStyle = { background: 'rgba(30, 41, 59, 0.7)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '500px', width: '100%', textAlign: 'center', backdropFilter: 'blur(10px)' };
const badgeStyle = { color: '#60a5fa', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', marginBottom: '15px', background: 'rgba(59, 130, 246, 0.1)', display: 'inline-block', padding: '5px 12px', borderRadius: '20px' };
const titleStyle = { color: 'white', fontSize: '22px', fontWeight: '800', marginBottom: '25px' };
const infoBoxStyle = { textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '20px' };
const labelStyle = { color: '#94a3b8', fontSize: '12px', marginBottom: '5px' };
const hashStyle = { color: '#60a5fa', fontSize: '11px', wordBreak: 'break-all' };
const dividerStyle = { border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '25px 0' };
const successBoxStyle = { padding: '20px', borderRadius: '15px', background: 'rgba(16, 185, 129, 0.1)', marginBottom: '20px' };
const errorBoxStyle = { padding: '20px', borderRadius: '15px', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' };
const detailsStyle = { textAlign: 'left', color: 'white', fontSize: '13px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' };
const backButtonStyle = { marginTop: '30px', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' };
const cronosButtonStyle = { display: 'block', marginTop: '20px', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', padding: '12px', borderRadius: '10px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', border: '1px solid rgba(96, 165, 250, 0.3)', textAlign: 'center' };