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
