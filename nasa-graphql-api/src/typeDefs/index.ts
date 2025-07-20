import { gql } from 'graphql-tag';
// OR alternatively:
// import gql from 'graphql-tag';

export const typeDefs = gql`
  """
  NASA Astronomy Picture of the Day
  """
  type APOD {
    date: String!
    title: String!
    url: String!
    hdurl: String
    explanation: String!
    mediaType: String!
    serviceVersion: String
    copyright: String
  }

  """
  NASA Near Earth Object
  """
  type NEO {
    id: String!
    name: String!
    absoluteMagnitude: Float
    estimatedDiameter: EstimatedDiameter!
    isPotentiallyHazardous: Boolean!
    closeApproachDate: String!
    missDistance: MissDistance!
    relativeVelocity: RelativeVelocity!
  }

  """
  Estimated diameter of a Near Earth Object
  """
  type EstimatedDiameter {
    min: Float!
    max: Float!
  }

  """
  Miss distance information for a Near Earth Object
  """
  type MissDistance {
    kilometers: Float!
  }

  """
  Relative velocity information for a Near Earth Object
  """
  type RelativeVelocity {
    kmPerHour: Float!
  }

  """
  Root Query type
  """
  type Query {
    """
    Get Astronomy Pictures of the Day for a date range
    If no dates provided, returns today's APOD
    """
    getAPODs(startDate: String, endDate: String, count: Int): [APOD!]!
    
    """
    Get a single APOD for a specific date
    """
    getAPOD(date: String!): APOD
    
    """
    Get Near Earth Objects for a date range (max 7 days)
    """
    getNEOs(startDate: String!, endDate: String!): [NEO!]!
    
    """
    Health check endpoint
    """
    health: String!
  }
`;