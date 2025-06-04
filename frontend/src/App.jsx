import { useState } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import TodoList from './components/TodoList';
import './App.css';

function App() {
  // Estado para el token y el email del usuario
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState(localStorage.getItem('email'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));

  // Se ejecuta al iniciar sesión correctamente
  const handleLogin = (userEmail, authToken, id) => {
    setToken(authToken);
    setEmail(userEmail);
    setUserId(id);
    localStorage.setItem('token', authToken);
    localStorage.setItem('email', userEmail);
    localStorage.setItem('userId', id);
  };

  // Cerrar sesión
  const handleLogout = () => {
    setToken(null);
    setEmail(null);
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
  };

  return (
    <div className="App">
      <h1>TodoÓptica</h1>
      {token ? (
        <>
          <div className="welcome">
            <p>Bienvenido, {email}!</p>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
          <TodoList />
        </>
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
