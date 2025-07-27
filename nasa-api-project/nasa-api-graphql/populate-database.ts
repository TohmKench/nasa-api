import { populateDatabase } from './database-solution';

// Script to populate the database with Mars Rover data
const populateAllRovers = async () => {
  const rovers = ['curiosity', 'perseverance', 'opportunity', 'spirit'];
  
  console.log('Starting database population for all rovers...');
  
  for (const rover of rovers) {
    console.log(`\n=== Populating data for ${rover.toUpperCase()} ===`);
    await populateDatabase(rover);
    console.log(`Completed ${rover.toUpperCase()}`);
  }
  
  console.log('\n=== Database population completed! ===');
  console.log('You can now use the database-driven GraphQL resolvers.');
};

// Run the population script
populateAllRovers().catch(console.error); 