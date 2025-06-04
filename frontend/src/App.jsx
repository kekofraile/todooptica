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
    <div className="App max-w-md mx-auto mt-8 p-6 bg-white rounded shadow text-center space-y-6">
      <h1 className="text-2xl font-bold">TodoÓptica</h1>
      {token ? (
        <div className="welcome space-y-4">
          <p>Bienvenido, {email}!</p>
          <button onClick={handleLogout} className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900">Cerrar sesión</button>
        </div>
      ) : (
        <div className="forms space-y-8">
          <LoginForm onLogin={handleLogin} />
          <RegisterForm />
        </div>
      )}
    </div>
  );
}

export default App;
