import app from './src/app.js';
import connectDB from './src/config/database.js'
import { connectPostgres } from './src/config/postgres.js';

async function initDatabases() {
  await connectDB();
  await connectPostgres();
}

initDatabases();

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})