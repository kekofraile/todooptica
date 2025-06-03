import { useState } from 'react';

// URL base de la API
const API_URL = 'http://localhost:5000';

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Enviar datos de registro al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al registrarse');
        return;
      }
      setMessage('Registro exitoso. Ya puedes iniciar sesión.');
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError('Error de red');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Registro</h2>
      <input
        type="text"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Registrarse</button>
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
