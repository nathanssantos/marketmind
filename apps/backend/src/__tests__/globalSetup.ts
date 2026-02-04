import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;

export async function setup(): Promise<void> {
  console.log('\n> Starting shared test database container...');

  container = await new PostgreSqlContainer('timescale/timescaledb:latest-pg17')
    .withDatabase('marketmind_test')
    .withUsername('test')
    .withPassword('test')
    .withReuse()
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();
  console.log(`✓ Test database ready at ${container.getHost()}:${container.getPort()}`);
}

export async function teardown(): Promise<void> {
  console.log('\n> Stopping test database container...');

  if (container) {
    await container.stop();
    container = null;
    console.log('✓ Test database container stopped');
  }
}
