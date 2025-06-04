import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:5000';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/todos?userId=${localStorage.getItem('userId') || ''}`)
      .then((res) => res.json())
      .then(setTodos)
      .catch(() => setError('Error loading todos'))
      .finally(() => setLoading(false));
  }, []);

  const addTodo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId: localStorage.getItem('userId') }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const todo = await res.json();
      setTodos([...todos, todo]);
      setText('');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleTodo = async (todo) => {
    try {
      const res = await fetch(`${API_URL}/api/todos/${todo._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      const updated = await res.json();
      setTodos(todos.map((t) => (t._id === updated._id ? updated : t)));
    } catch {
      setError('Error updating todo');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await fetch(`${API_URL}/api/todos/${id}`, { method: 'DELETE' });
      setTodos(todos.filter((t) => t._id !== id));
    } catch {
      setError('Error deleting todo');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Mis Tareas</h2>
      <form onSubmit={addTodo}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nueva tarea"
          required
        />
        <button type="submit">Agregar</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul>
        {todos.map((t) => (
          <li key={t._id}>
            <label>
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => toggleTodo(t)}
              />
              {t.text}
            </label>
            <button onClick={() => deleteTodo(t._id)}>Eliminar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
