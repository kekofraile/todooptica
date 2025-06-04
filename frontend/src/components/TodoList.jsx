import { useState } from 'react';

export default function TodoList() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks([...tasks, text]);
    setNewTask('');
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditText(tasks[index]);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const updated = tasks.map((t, i) => (i === editingIndex ? editText : t));
    setTasks(updated);
    setEditingIndex(null);
    setEditText('');
  };

  const deleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          type="text"
          placeholder="Nueva tarea"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />
        <button
          type="button"
          onClick={addTask}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Agregar
        </button>
      </div>
      <ul className="space-y-2">
        {tasks.map((task, index) => (
          <li key={index} className="flex items-center space-x-2">
            {editingIndex === index ? (
              <>
                <input
                  className="flex-1 border rounded px-2 py-1"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Guardar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-left">{task}</span>
                <button
                  type="button"
                  onClick={() => startEdit(index)}
                  className="bg-gray-300 px-2 py-1 rounded hover:bg-gray-400"
                >
                  Editar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => deleteTask(index)}
              className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
