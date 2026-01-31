import WalletConnect from "./WalletConnect";

export default function LoginForm({ onSwitch }) {
  return (
    <div style={containerStyle}>
      <div className="glass-card" style={formStyle}>
        <h2 style={titleStyle}>ĐĂNG NHẬP</h2>
        <p style={subtitleStyle}>Hệ thống quản lý hồ sơ sinh viên Blockchain</p>

        {/* Cổng đăng nhập duy nhất bằng MetaMask */}
        <WalletConnect />
        
        <p style={switchPageStyle}>
          Chưa có tài khoản? <span style={linkStyle} onClick={onSwitch}>Đăng ký ngay</span>
        </p>
      </div>
    </div>
  );
}

// --- Giữ nguyên hệ thống Style Blue Design của bạn ---
const containerStyle = { maxWidth: '420px', margin: '0 auto', textAlign: 'center' };
const formStyle = {
  padding: '40px 30px',
  background: 'rgba(30, 58, 138, 0.4)',
  borderRadius: '24px',
  border: '1px solid rgba(96, 165, 250, 0.3)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.2)',
};
const titleStyle = { fontSize: '28px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '5px' };
const subtitleStyle = { fontSize: '14px', color: '#93c5fd', marginBottom: '30px' };
const switchPageStyle = { marginTop: '20px', fontSize: '14px', color: '#cbd5e1' };
const linkStyle = { color: '#60a5fa', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' };