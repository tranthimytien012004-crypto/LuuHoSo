import { useState } from "react";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div style={authPageStyle}>
      <div className="glass-card" style={authContainerStyle}>
        {isLogin ? (
          <LoginForm onSwitch={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitch={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
}

const authPageStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '80vh',
  width: '100%'
};

const authContainerStyle = {
  padding: '40px',
  width: '100%',
  maxWidth: '450px',
  background: 'rgba(30, 58, 138, 0.4)', // Xanh dương đồng bộ
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(15px)',
};