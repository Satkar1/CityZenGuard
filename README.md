# AI-Powered Legal Assistance System

## Overview

This is a full-stack AI-powered legal assistance system designed to bridge the gap between citizens and the judicial system in India. The application provides intelligent legal services through an AI chatbot for citizens and automated FIR (First Information Report) drafting tools for police officers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom legal-themed color scheme
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for RESTful API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **AI Integration**: Google Gemini AI for legal content analysis and chatbot responses
- **File Generation**: jsPDF for FIR document generation

### Database Design
- **Users**: Stores citizen and police officer accounts with role-based access
- **Cases**: Tracks legal cases for citizens with status and hearing information
- **FIRs**: Manages First Information Reports with AI-suggested legal sections
- **Chat Messages**: Stores conversation history between users and AI assistant
- **Notifications**: Handles system notifications for users

## Key Components

### Authentication System
- Role-based authentication (citizen/police)
- JWT token management with secure storage
- Password hashing using bcrypt
- Protected routes based on user roles

### AI Chat Interface
- Multilingual support capability (designed for English, Hindi, Marathi)
- Context-aware legal assistance
- Integration with Google Gemini AI for intelligent responses
- Real-time chat with message history persistence

### FIR Drafting System
- Multi-step form wizard for structured data collection
- AI-powered legal section suggestions based on incident description
- Automatic IPC (Indian Penal Code) section recommendations
- PDF generation with proper legal formatting
- Draft saving and submission workflow

### Case Management
- Case status tracking for citizens
- Hearing date notifications
- Case history and document management
- Integration with judicial information systems (designed for NJDG API)

## Data Flow

1. **User Authentication**: Users register/login with role selection (citizen/police)
2. **Citizen Flow**: Access dashboard → Chat with AI assistant → View case status → Receive notifications
3. **Police Flow**: Access dashboard → Draft FIR → Get AI legal section suggestions → Generate PDF → Submit FIR
4. **AI Processing**: User queries → Gemini AI analysis → Contextual legal responses → Database storage

## External Dependencies

### Core Libraries
- **@google/genai**: Google Gemini AI integration for legal assistance
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **bcrypt**: Password hashing and verification
- **jsonwebtoken**: JWT token generation and verification
- **jspdf**: PDF document generation for FIRs

### UI Libraries
- **@radix-ui/***: Accessible UI component primitives
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation
- **zod**: Schema validation
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **drizzle-kit**: Database schema management and migrations
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- Local development with hot reloading via Vite
- Database migrations using Drizzle Kit
- Environment variable configuration for API keys and database URLs

### Production Build Process
1. Frontend build using Vite (outputs to `dist/public`)
2. Backend build using esbuild (outputs to `dist/index.js`)
3. Single deployment artifact containing both frontend and backend

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string (required)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`: Google AI API key for legal assistance
- `JWT_SECRET`: Secret key for JWT token signing

### Containerization Ready
- Docker configuration implied through build process
- Microservices architecture support for different modules
- Logging and monitoring capabilities built into Express middleware

The system is designed with scalability in mind, supporting future extensions like multilingual NLP processing, integration with official judicial APIs, and advanced case analytics.
