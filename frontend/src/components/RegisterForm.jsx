import WalletConnect from "./WalletConnect";

export default function RegisterForm({ onSwitch }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={titleStyle}>ĐĂNG KÝ</h2>
      <p style={subtitleStyle}>Khởi tạo hồ sơ sinh viên trên Blockchain</p>

      {/* Chỉ cần Component này để kết nối và tự động đăng ký */}
      <WalletConnect />

      <p style={{ marginTop: '20px', fontSize: '14px', color: '#cbd5e1' }}>
        Hệ thống sẽ tự động tạo tài khoản dựa trên địa chỉ ví của bạn.
      </p>

      <p style={{ marginTop: '20px', fontSize: '14px', color: '#cbd5e1' }}>
        Đã có tài khoản? <span style={linkStyle} onClick={onSwitch}>Đăng nhập ngay</span>
      </p>
    </div>
  );
}

// --- Styles giữ nguyên như của bạn ---
const titleStyle = { fontSize: '28px', color: '#60a5fa', marginBottom: '5px' };
const subtitleStyle = { fontSize: '14px', color: '#93c5fd', marginBottom: '30px' };
const linkStyle = { color: '#60a5fa', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' };