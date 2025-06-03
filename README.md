# todooptica

This project is a basic TODO API using Node.js and MongoDB.

## Prerequisites

- [Node.js](https://nodejs.org/) and `npm` installed.
- A running MongoDB instance accessible to the server.

## Environment setup

1. Open a terminal and navigate to the `backend` directory:

   ```bash
   cd backend
   ```

2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file and edit it with your values:

   ```bash
   cp .env.example .env
   ```

   The `.env` file should define at least the following variables:

   ```
   MONGO_URI=<your MongoDB connection string>
   JWT_SECRET=<your JWT secret>
   PORT=5000
   ```

## Running the server

While still in the `backend` directory, start the API server with:

```bash
npm start
```

The server will run on the port specified by the `PORT` variable in your `.env` file (default is `5000`).

## Notes

- Ensure MongoDB is running and reachable using the `MONGO_URI` provided.
- You can use tools like `nodemon` for automatic restarts during development, but the default command is `npm start`.
