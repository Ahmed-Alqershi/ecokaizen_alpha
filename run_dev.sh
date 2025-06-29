#!/bin/bash

# Start backend
echo "Starting backend server..."
cd backend
python app.py &
BACKEND_PID=$!
cd ..

# Start frontend
echo "Starting frontend development server..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

# Handle cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT

# Keep script running
wait