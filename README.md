# 🚀 Marketing Machine

An automated LinkedIn content creation system that transforms meeting recordings and text content into high-quality social media posts.

## ✨ Features

### 🎯 Core Capabilities
- **Multi-Input Support** - Meeting webhooks, manual paste, file uploads
- **Intelligent Hook Generation** - Extract 10 marketing hooks per content piece
- **Context-Rich Posts** - Generate 1500-2200 character LinkedIn posts
- **Multi-Model Images** - DALL-E 3, Stable Diffusion, Midjourney support
- **In-App Approval** - Review dashboard with inline editing
- **Smart Scheduling** - Optimal timing with performance-based posting

### 🔧 Technical Stack
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS
- **AI Models**: OpenAI GPT-4, DALL-E 3, Stable Diffusion
- **Deployment**: Hetzner VPS with Docker
- **Queue**: Bull Queue with Redis
- **Testing**: Jest + Playwright

## 🏗️ Project Structure

```
marketing-machine/
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── config/    # Database, Redis, AI configs
│   │   ├── models/    # Database models
│   │   ├── services/  # Business logic
│   │   ├── controllers/ # Route handlers
│   │   ├── routes/    # API routes
│   │   └── utils/     # Helper functions
│   └── tests/         # Backend tests
├── frontend/          # React application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/     # App pages
│   │   ├── hooks/     # Custom hooks
│   │   └── services/  # API services
│   └── tests/         # Frontend tests
├── database/          # SQL schemas and migrations
├── docker/            # Docker configuration
└── docs/              # Documentation

```

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- OpenAI API Key

### 2. Installation
```bash
git clone <repository>
cd marketing-machine
npm install
```

### 3. Environment Setup
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Frontend environment  
cp frontend/.env.example frontend/.env
```

### 4. Database Setup
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start Development
```bash
npm run dev
```

This starts:
- Backend API on http://localhost:3001
- Frontend app on http://localhost:5173
- PostgreSQL on port 5432
- Redis on port 6379

## 🎯 Usage

### Company Onboarding
1. Navigate to company setup
2. Configure brand voice and ICP
3. Upload knowledge sources
4. Set approval preferences

### Content Processing
1. **Manual Input**: Paste transcripts or upload files
2. **Webhook Integration**: Connect meeting recorders
3. **Hook Generation**: AI extracts 10 marketing angles
4. **Post Creation**: Generate LinkedIn-optimized content
5. **Image Generation**: Create branded visuals
6. **Approval Workflow**: Review and edit before publishing
7. **Smart Publishing**: Schedule at optimal times

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Guide](docs/USER_GUIDE.md)
- [Developer Guide](docs/DEVELOPER.md)

## 🧪 Testing

```bash
# All tests
npm test

# Backend only
npm run test:backend

# Frontend only  
npm run test:frontend

# Linting
npm run lint
```

## 🚀 Deployment

### Hetzner VPS Setup
```bash
# Production deployment
npm run deploy
```

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

## 📊 Performance Metrics

- **Processing Time**: <60 seconds per content piece
- **Hook Generation**: 10 hooks per input
- **Post Quality**: 1500-2200 characters, LinkedIn optimized
- **Cost**: ~$0.30-0.60 per complete content piece
- **Success Rate**: >95% processing success

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: `/docs` folder
- **API**: Full OpenAPI specification available

---

**Status**: 🚧 Under Development
**Version**: 1.0.0
**Last Updated**: August 2024