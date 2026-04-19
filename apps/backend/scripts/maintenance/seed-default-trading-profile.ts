import 'dotenv/config';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { seedDefaultTradingProfile } from '../../src/services/user-indicators';

const main = async (): Promise<void> => {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  console.log(`Found ${allUsers.length} user(s).`);

  for (const user of allUsers) {
    await seedDefaultTradingProfile(user.id);
    console.log(`  [${user.email}] ensured default trading profile`);
  }

  console.log('Done.');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
