import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function WalletConnect() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // TỰ ĐỘNG LẤY LINK TỪ VERCEL CONFIG HOẶC LOCALHOST
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/students";

  const loginWithWallet = async (walletAddress) => {
    try {
      setLoading(true);
      // Gọi API đến Render (Không dùng localhost ở đây nữa)
      const res = await axios.post(`${API_URL}/wallet-login`, {
        walletAddress: walletAddress
      });

      if (res.data.success) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        alert("Đăng nhập thành công!");
        navigate("/");
        window.location.reload();
      }
    } catch (err) {
      console.error("Lỗi đăng nhập hệ thống:", err);
      alert("Hệ thống Backend (Render) chưa phản hồi. Vui lòng đợi 1-2 phút để server khởi động lại!");
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setLoading(true);
        // Bước 1: Xin quyền (giúp đổi ví dễ dàng hơn)
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });

        // Bước 2: Lấy địa chỉ ví
        const accounts = await window.ethereum.request({ 
          method: "eth_requestAccounts" 
        });
        
        const addr = accounts[0];
        setAccount(addr);
        
        // Bước 3: Đăng nhập
        await loginWithWallet(addr);

      } catch (err) {
        console.error("Lỗi kết nối ví:", err);
        setLoading(false);
      }
    } else {
      alert("Vui lòng cài đặt Metamask!");
    }
  };

  return (
    <div className="glass-card" style={containerStyle}>
      {account ? (
        <div style={{ textAlign: 'center' }}>
          <div style={statusConnectedStyle}>
            <span style={dotStyle}>●</span> 
            {loading ? "Đang xác thực hệ thống..." : "Đã kết nối Blockchain"}
          </div>
          <p style={addressStyle}>Ví: {account.substring(0, 6)}...{account.slice(-4)}</p>
        </div>
      ) : (
        <div>
          <p style={{ color: "#94a3b8", fontSize: '14px', marginBottom: '15px' }}>
            Sử dụng ví điện tử để truy cập nhanh
          </p>
          <button onClick={connectWallet} style={connectBtnStyle} disabled={loading}>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Mirror_Logo.svg" 
              style={{ width: '20px', marginRight: '10px' }} 
              alt="fox"
            />
            {loading ? "ĐANG XỬ LÝ..." : "KẾT NỐI METAMASK"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Giữ nguyên Style của bạn ---
const containerStyle = {
  padding: "30px",
  background: "rgba(15, 23, 42, 0.6)", 
  borderRadius: "20px",
  border: "1px solid rgba(96, 165, 250, 0.2)",
  textAlign: "center"
};
const statusConnectedStyle = { color: "#4ade80", fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" };
const dotStyle = { fontSize: '18px' };
const addressStyle = { fontSize: "13px", color: "#93c5fd", marginTop: "10px", fontFamily: "monospace", background: "rgba(0,0,0,0.2)", padding: "5px", borderRadius: "5px" };
const connectBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: "linear-gradient(45deg, #f6851b, #e2761b)", color: "white", border: "none", padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 15px rgba(246, 133, 27, 0.4)", fontSize: "15px" };