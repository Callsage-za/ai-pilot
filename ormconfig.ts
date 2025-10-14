const { DataSource } = require('typeorm');
const path = require('path');

module.exports = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '',
  database: 'ai_pilot',
  logging: false, 
  synchronize: false,
  entities: [path.join(__dirname, 'src/entities/*{.ts,.js}')],
  migrations: [path.join(__dirname, 'src/migrations/*{.ts,.js}')],
});
