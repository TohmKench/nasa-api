import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

import { typeDefs } from './typeDefs';
import { resolvers } from './resolvers';
import { database } from './db';

// Load environment variables
dotenv.config();

async function startServer() {
    // Create Express app
    const app = express();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Create Apollo Server
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
        introspection: process.env.NODE_ENV !== 'production',
    });

    // Start Apollo Server
    await server.start();

    // Configure middleware
    app.use(
        '/graphql',
        cors<cors.CorsRequest>({
            origin: process.env.NODE_ENV === 'production'
                ? ['https://yourdomain.com']
                : ['http://localhost:3000', 'http://localhost:4000'],
            credentials: true
        }),
        express.json(),
        expressMiddleware(server)
    );

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'NASA GraphQL API'
        });
    });

    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            message: 'NASA GraphQL API',
            version: '1.0.0',
            endpoints: {
                graphql: '/graphql',
                health: '/health'
            }
        });
    });

    const PORT = process.env.PORT || 4000;

    // Start HTTP server
    await new Promise<void>((resolve) => {
        httpServer.listen({ port: PORT }, resolve);
    });

    console.log(`🚀 NASA GraphQL API ready at http://localhost:${PORT}/graphql`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
}

// Start the server
startServer().catch((error) => {
    console.error('Error starting server:', error);
    process.exit(1);
});