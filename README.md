# NASA GraphQL API

A TypeScript GraphQL API for NASA data using Apollo Server with SQLite caching.

## 🚀 Features

- **GraphQL API** with Apollo Server v4
- **TypeScript** for type safety
- **SQLite caching** for improved performance
- **NASA APOD** (Astronomy Picture of the Day) queries
- **NASA NEO** (Near Earth Objects) queries
- **Automatic caching** with configurable TTL
- **Error handling** and validation
- **Health checks** and monitoring

## 📁 Project Structure

```
src/
├── models/          # Database models for caching
│   ├── APODModel.ts
│   └── NEOModel.ts
├── resolvers/       # GraphQL resolvers
│   └── index.ts
├── services/        # External API services
│   └── NASAService.ts
├── typeDefs/        # GraphQL schema definitions
│   └── index.ts
├── types/           # TypeScript type definitions
│   └── index.ts
├── db.ts           # SQLite database setup
└── server.ts       # Main server entry point
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nasa-graphql-api.git
   cd nasa-graphql-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your NASA API key:
   ```
   NASA_API_KEY=your_nasa_api_key_here
   PORT=4000
   NODE_ENV=development
   CACHE_DURATION_HOURS=6
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🔑 Getting a NASA API Key

1. Visit [NASA API Portal](https://api.nasa.gov/)
2. Sign up for a free API key
3. Add it to your `.env` file

## 📊 GraphQL Queries

### Get APOD Data

```graphql
# Get today's APOD
query {
  getAPODs {
    date
    title
    url
    hdurl
    explanation
    mediaType
  }
}

# Get APOD for date range
query {
  getAPODs(startDate: "2023-12-01", endDate: "2023-12-07") {
    date
    title
    url
    explanation
  }
}

# Get specific APOD
query {
  getAPOD(date: "2023-12-01") {
    title
    url
    explanation
  }
}
```

### Get NEO Data

```graphql
query {
  getNEOs(startDate: "2023-12-01", endDate: "2023-12-07") {
    id
    name
    isPotentiallyHazardous
    closeApproachDate
    estimatedDiameter {
      min
      max
    }
    missDistance {
      kilometers
    }
    relativeVelocity {
      kmPerHour
    }
  }
}
```

## 🌐 API Endpoints

- **GraphQL Playground**: `http://localhost:4000/graphql`
- **Health Check**: `http://localhost:4000/health`
- **Root**: `http://localhost:4000/`

## 📝 Scripts

```bash
npm run dev        # Start development server with hot reload
npm run build      # Build for production
npm start          # Start production server
npm test           # Run tests (if configured)
```

## 🗄️ Database

The API uses SQLite for caching NASA data to improve performance and reduce API calls. The database file (`nasa_cache.db`) is automatically created when you start the server.

### Cache Strategy

- **APOD data**: Cached for 6 hours (configurable)
- **NEO data**: Cached for 6 hours (configurable)
- **Automatic cleanup**: Stale data is refreshed from NASA API

## 🔧 Configuration

Environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NASA_API_KEY` | Your NASA API key | `DEMO_KEY` |
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment | `development` |
| `CACHE_DURATION_HOURS` | Cache TTL in hours | `6` |

## 🚦 Error Handling

The API includes comprehensive error handling:

- **Invalid date formats**: Returns helpful error messages
- **NASA API failures**: Graceful fallback with caching
- **Database errors**: Automatic retry logic
- **Rate limiting**: Respects NASA API limits

## 🔒 Security

- API keys are never exposed in logs
- Input validation on all queries
- CORS configured for production
- SQL injection protection with parameterized queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [NASA Open Data Portal](https://api.nasa.gov/) for providing amazing space data
- [Apollo GraphQL](https://www.apollographql.com/) for the excellent GraphQL server
- [SQLite](https://sqlite.org/) for the lightweight database

## 📞 Support

If you have any questions or run into issues, please [open an issue](https://github.com/yourusername/nasa-graphql-api/issues) on GitHub.