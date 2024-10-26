# Final Project Frontend

This is the frontend for the Final Project, built with React and deployed on Vercel. The application allows users to create, edit, and view posts, with data provided by the backend API.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)

## Features
- User authentication (login and registration)
- CRUD operations for posts (create, edit, delete, view)
- Responsive design with styled components
- Integration with backend API

## Tech Stack
- **Frontend**: React, React Router, React Quill (for rich text editing)
- **Deployment**: Vercel

## Environment Variables

To run this project, you need to set the following environment variable:

| Variable Name       | Description                             |
|---------------------|-----------------------------------------|
| `REACT_APP_API_URL` | URL of the backend API                 |

For example, in your `.env` file:
```plaintext
REACT_APP_API_URL=https://final-project-backend-ed7a.vercel.app/
