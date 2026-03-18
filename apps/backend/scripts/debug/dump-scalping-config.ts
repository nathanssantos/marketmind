import { db } from '../../src/db';
import { scalpingConfig } from '../../src/db/schema';

const main = async () => {
  const configs = await db.query.scalpingConfig.findMany();
  for (const c of configs) {
    console.log(JSON.stringify(c, null, 2));
  }
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
