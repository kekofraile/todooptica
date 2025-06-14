# todooptica

This project is a basic TODO API using Node.js and MongoDB.

## Prerequisites

- Node.js (tested with v18)
- MongoDB

## Setup

1. `cd backend`
2. `npm install`
3. Copy `backend/.env.example` to `backend/.env` and set your variables
4. `npm start`

## Environment variables

- `MONGO_URI` – connection string for MongoDB.
- `JWT_SECRET` – secret used to sign authentication tokens.
- `PORT` – port where the API server runs.

## API routes

- `POST /api/users/register` – register a new user.
- `POST /api/users/login` – log in and receive a token.
- `GET /api/todos` – list todos for a user (pass `userId` as query).
- `POST /api/todos` – create a todo.
- `PUT /api/todos/:id` – update a todo.
- `DELETE /api/todos/:id` – delete a todo.

## Frontend

This repository also contains a simple React frontend created with Vite.

### Setup

1. `cd frontend`
2. `npm install`
3. `npm run dev` – starts the development server at `http://localhost:3000`.

After logging in you will see a simple todo list where you can add,
edit and delete tasks. These actions communicate with the backend
routes described above.
