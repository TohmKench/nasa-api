# NASA GraphQL API

A TypeScript GraphQL API for NASA data using Apollo Server with SQLite caching.

## Features

- **GraphQL API** with Apollo Server
- **TypeScript** for type safety
- **SQLite caching** for improved performance
- **NASA APOD** (Astronomy Picture of the Day) queries
- **NASA NEO** (Near Earth Objects) queries
- **Automatic caching** with configurable TTL
- **Error handling** and validation
- **Health checks** and monitoring

## Installation

```bash
# Clone the repository
git clone <your-repo>
cd nasa-graphql-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your NASA API key

# Start development server
npm run dev
```

## Environment Variables

```
NASA_API_KEY=your_nasa_api_key_here
PORT=4000
NODE_ENV=development
CACHE_DURATION_HOURS=6
```

## GraphQL Queries

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

## API Endpoints

- **GraphQL**: `http://localhost:4000/graphql`
- **Health Check**: `http://localhost:4000/health`
- **Root**: `http://localhost:4000/`

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm start          # Start production server
npm test           # Run tests
```

## License

MIT