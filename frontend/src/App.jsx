import { useState } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import './App.css';

function App() {
  // Estado para el token y el email del usuario
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState(localStorage.getItem('email'));

  // Se ejecuta al iniciar sesión correctamente
  const handleLogin = (userEmail, authToken) => {
    setToken(authToken);
    setEmail(userEmail);
    localStorage.setItem('token', authToken);
    localStorage.setItem('email', userEmail);
  };

  // Cerrar sesión
  const handleLogout = () => {
    setToken(null);
    setEmail(null);
    localStorage.removeItem('token');
    localStorage.removeItem('email');
  };

  return (
    <div className="App">
      <h1>TodoÓptica</h1>
      {token ? (
        <div className="welcome">
          <p>Bienvenido, {email}!</p>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      ) : (
        <div className="forms">
          <LoginForm onLogin={handleLogin} />
          <RegisterForm />
        </div>
      )}
    </div>
  );
}

export default App;
