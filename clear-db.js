import Database from 'better-sqlite3';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const db = new Database(path.join(dataDir, 'database.sqlite'));

console.log('Clearing database...');
db.exec('DELETE FROM task_members');
db.exec('DELETE FROM space_members');
db.exec('DELETE FROM tasks');
db.exec('DELETE FROM spaces');
db.exec('DELETE FROM users');
console.log('Database cleared successfully.');
db.close();
