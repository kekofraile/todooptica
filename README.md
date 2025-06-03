# TodoOptica

This project contains the backend API for TodoOptica.

## Prerequisites

- [Node.js](https://nodejs.org/) and `npm` installed.
- A running MongoDB instance accessible to the server.

## Installation

1. Open a terminal and navigate to the `backend` directory:

   ```bash
   cd backend
   ```

2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables. Copy the example file and edit it with your values:

   ```bash
   cp .env.txt .env
   ```

   The `.env` file should define at least the following variables:

   ```
   MONGO_URI=<your MongoDB connection string>
   JWT_SECRET=<your JWT secret>
   PORT=5000
   ```

## Running the server

Once the dependencies are installed and `.env` is configured, start the API server with:

```bash
npm start
```

The server will run on the port specified by the `PORT` variable in your `.env` file (default is 5000).

## Notes

- Ensure MongoDB is running and reachable using the `MONGO_URI` provided.
- Some development setups use tools like `nodemon` for automatic restarts, but this project runs with `npm start`.
