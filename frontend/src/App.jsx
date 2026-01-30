import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home'; 
import Auth from './pages/Auth'; 
import Verify from './pages/Verify';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Thêm trạng thái chờ kiểm tra user

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false); // Đã kiểm tra xong localStorage
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    alert("Đã đăng xuất!");
    navigate("/auth");
  };

  if (loading) return <div style={{background: '#0f172a', height: '100vh'}}></div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Navbar chỉ hiện ở Home và Auth, KHÔNG hiện ở Verify */}
      {location.pathname !== '/verify' && (
        <nav style={navContainerStyle}>
          <div style={navBrandStyle} onClick={() => navigate("/")}>🎓 StudentChain</div>
          <div style={navLinksStyle}>
            <Link to="/" style={location.pathname === '/' ? activeLinkStyle : navLinkStyle}>Trang chủ</Link>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={userEmailStyle}>👤 {user.email}</span>
                <button onClick={handleLogout} style={logoutButtonStyle}>Đăng xuất</button>
              </div>
            ) : (
              <Link to="/auth" style={location.pathname === '/auth' ? activeLinkStyle : navLinkStyle}>Đăng nhập</Link>
            )}
          </div>
        </nav>
      )}

      <main style={mainContentStyle}>
        <Routes>
  {/* ĐƯỜNG DẪN GỐC: Phải luôn hiện Home với isLanding={true} */}
  <Route path="/" element={<Home isLanding={true} />} />

  {/* TRANG ĐĂNG NHẬP: Hiện trang kết nối MetaMask */}
  <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />

  {/* TRANG QUẢN LÝ: Chỉ hiện bảng hồ sơ khi đã đăng nhập */}
  <Route 
    path="/dashboard" 
    element={user ? <Home isLanding={false} /> : <Navigate to="/auth" replace />} 
  />

  <Route path="/verify" element={<Verify />} />
</Routes>
      </main>

      <footer style={footerStyle}>© 2026 Hệ thống Quản lý Sinh viên Blockchain</footer>
    </div>
  );
}

// Các style giữ nguyên như cũ của bạn...
const mainContentStyle = { flex: 1, padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' };
const navContainerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 60px', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, zIndex: 100 };
const navBrandStyle = { fontSize: '24px', fontWeight: '800', background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', cursor: 'pointer' };
const navLinksStyle = { display: 'flex', gap: '30px', alignItems: 'center' };
const navLinkStyle = { color: '#94a3b8', textDecoration: 'none' };
const activeLinkStyle = { color: '#60a5fa', textDecoration: 'none', borderBottom: '2px solid #60a5fa', fontWeight: 'bold' };
const userEmailStyle = { color: '#93c5fd', fontSize: '14px' };
const logoutButtonStyle = { padding: '8px 18px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', cursor: 'pointer' };
const footerStyle = { textAlign: 'center', padding: '30px', color: '#475569', fontSize: '13px' };

export default App;