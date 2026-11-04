import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const email = (process.argv[2] || 'admin@edulms.edu').toLowerCase().trim();
const password = process.argv[3] || 'Admin123!';
const name = process.argv[4] || 'System Administrator';

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database...');

    let user = await User.findOne({ email });

    if (user) {
      user.role = 'admin';
      if (process.argv[3]) {
        user.password = password; // pre('save') hook hashes with bcrypt
      }
      await user.save();
      console.log(`✓ Existing user "${email}" promoted to role: "admin"`);
    } else {
      user = await User.create({
        name,
        email,
        password,
        role: 'admin',
        termsAccepted: true,
      });
      console.log(`✓ New admin account created successfully!`);
      console.log(`  Email:    ${email}`);
      console.log(`  Password: ${password}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
}

seedAdmin();
