import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.test from workspace root — single source of truth for all E2E files
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });
