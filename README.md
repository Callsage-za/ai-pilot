# AI Copilot Backend

A comprehensive NestJS backend application for AI-powered call center operations, featuring real-time chat, document processing, audio analysis, and policy management.

## 🚀 Features

- **Real-time Chat System**: WebSocket-based chat with AI assistance
- **Audio Processing**: Speech-to-text, sentiment analysis, and classification
- **Document Management**: PDF processing, policy document management
- **Call Analytics**: Call recording analysis, entity extraction, and evidence tracking
- **Policy Compliance**: Automated policy auditing and compliance checking
- **JIRA Integration**: Ticket creation and management
- **File Upload**: Multi-format file processing and storage
- **Authentication**: JWT-based authentication system
- **Database**: MySQL with TypeORM for data persistence

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **Database**: MySQL with TypeORM
- **Authentication**: JWT with Passport
- **WebSockets**: Socket.IO for real-time communication
- **AI Integration**: Google Gemini AI
- **Audio Processing**: Google Cloud Speech API
- **File Processing**: PDF parsing, document analysis
- **Validation**: Class-validator, Zod
- **Testing**: Jest

## 📋 Prerequisites

- Node.js (v18 or higher)
- MySQL database
- Google Cloud credentials (for AI and Speech services)
- Yarn package manager

## 🚀 Getting Started

### 1. Installation

```bash
# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env
```

### 2. Environment Configuration

Create a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=ai_pilot

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account.json
GEMINI_API_KEY=your_gemini_api_key

# Application Configuration
NODE_ENV=development
PORT=8787

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4001
```

### 3. Database Setup

```bash
# Generate and run migrations
yarn generate-migration
yarn migrate-db
```

### 4. Development

```bash
# Start development server
yarn start:dev

# Start with debugging
yarn start:debug
```

### 5. Production

```bash
# Build the application
yarn build

# Start production server
yarn start:prod
```

## 📁 Project Structure

```
src/
├── app.module.ts              # Main application module
├── main.ts                    # Application entry point
├── config/                    # Configuration files
├── entities/                   # TypeORM entities
│   ├── call.entity.ts
│   ├── conversation.entity.ts
│   ├── message.entity.ts
│   ├── audio-file.entity.ts
│   ├── document.entity.ts
│   └── ...
├── logic/                      # Business logic modules
│   ├── auth/                   # Authentication
│   ├── chat/                   # Chat functionality
│   ├── speech/                 # Audio processing
│   ├── file-upload/           # File handling
│   ├── policy-documents/      # Policy management
│   ├── jira-tickets/          # JIRA integration
│   ├── tools/                 # Utility tools
│   └── socket-gateway/        # WebSocket handling
├── utils/                      # Utility functions
└── enums/                      # Type definitions
```

## 🔧 Available Scripts

```bash
# Development
yarn start:dev          # Start with file watching
yarn start:debug        # Start with debugging

# Building
yarn build              # Build for production
yarn start:prod         # Start production server

# Database
yarn generate-migration # Generate new migration
yarn migrate-db         # Run migrations

# Code Quality
yarn lint               # Run ESLint
yarn format             # Format code with Prettier

# Testing
yarn test               # Run unit tests
yarn test:watch         # Run tests in watch mode
yarn test:cov           # Run tests with coverage
yarn test:e2e           # Run end-to-end tests

# Code Generation
yarn generate           # Generate MVC components
```

## 🗄️ Database Schema

The application uses the following main entities:

- **Conversation**: Chat conversations with users
- **Message**: Individual messages in conversations
- **Call**: Call recordings and analytics
- **AudioFile**: Audio processing results
- **Document**: Document management
- **Policy**: Policy documents and sections
- **FileUpload**: File upload tracking
- **MemoryFact**: Conversation memory facts

## 🔌 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Chat
- `POST /chat/message` - Send chat message
- `GET /chat/conversations` - Get user conversations
- `GET /chat/conversations/:id` - Get specific conversation

### File Upload
- `POST /file-upload` - Upload files
- `GET /file-upload/:id` - Get file information

### Audio Processing
- `POST /speech/process` - Process audio files
- `GET /speech/audio/:id` - Get audio analysis results

### Documents
- `GET /documents` - List documents
- `POST /documents` - Upload document
- `GET /documents/:id` - Get document details

### Calls
- `GET /calls` - List calls
- `GET /calls/:id` - Get call details
- `POST /calls/search` - Search calls

## 🔒 Security

- JWT-based authentication
- CORS configuration for allowed origins
- Input validation with class-validator
- File upload security with type checking
- SQL injection protection with TypeORM

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:cov

# Run end-to-end tests
yarn test:e2e

# Run tests in watch mode
yarn test:watch
```

## 📊 Monitoring & Logging

The application includes:
- Request/response logging
- Error tracking
- Performance monitoring
- Database query logging (development mode)

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN yarn install --production
COPY . .
RUN yarn build
EXPOSE 8787
CMD ["yarn", "start:prod"]
```

### Environment Variables for Production

```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_PASSWORD=your_production_password
JWT_SECRET=your_production_jwt_secret
GOOGLE_APPLICATION_CREDENTIALS=/path/to/production/credentials.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the UNLICENSED License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation for common issues

## 🔄 Changelog

### v0.0.1
- Initial release
- Basic chat functionality
- Audio processing
- Document management
- Policy compliance features