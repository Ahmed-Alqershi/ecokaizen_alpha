# CGE Model Builder Platform

A web-based platform for building, solving, and comparing Computable General Equilibrium (CGE) models without writing code.

## Overview

This platform allows users to:

- Select from predefined CGE model templates
- Customize model parameters and Social Accounting Matrices (SAM)
- Solve CGE models and visualize results
- Compare different policy scenarios

## Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- AG-Grid for SAM table editing
- Recharts for data visualization
- React Router for navigation
- Axios for API calls

### Backend
- Python with Flask
- GAMSPY for CGE model solving
- NumPy for numerical operations

## Project Structure

```
/
├── frontend/                  # React frontend application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── screens/           # Page components
│   │   ├── utils/             # Utilities and helpers
│   │   ├── styles/            # CSS styles
│   │   ├── assets/            # Static assets
│   │   └── templates/         # Template descriptions
│   ├── public/                # Static files
│   ├── package.json           # NPM dependencies
│   └── ...                    # Other config files
│
└── backend/                   # Python backend
    ├── app.py                 # Main Flask application
    ├── models/                # CGE model implementations
    │   └── splcge.py          # Simple CGE model 
    ├── sam_utils/             # SAM generation utilities
    │   └── generator.py       # Random SAM generator
    └── requirements.txt       # Python dependencies
```

## Setup and Installation

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The application will be available at http://localhost:3000, with the backend API running at http://localhost:5001.

## Available CGE Models

In the MVP, only the Simple CGE model (2 goods, 2 factors, 1 household) is fully implemented.

Future versions will add:
- Standard CGE Model (with government, trade, and investment)
- Cameroon CGE Model (11 sectors)
- Korea CGE Model (3 sectors with multiple household types)

## Features

- Home page with overview of CGE models
- Model builder with step-by-step workflow
- Template selection interface
- SAM editor with CSV/Excel upload capability
- Parameter input forms
- Results visualization with charts
- Scenario comparison dashboard

## License

[MIT](LICENSE)