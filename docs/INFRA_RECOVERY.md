# Infrastructure recovery

How to recover lost rows in the MarketMind PostgreSQL database. This is the operational counterpart to V1_5_PLAN B.3 — the layout-loss incident on 2026-04-30 was unrecoverable because `wal_level=replica` + `archive_mode=off` was the default. Going forward, WAL archiving is enabled in `docker-compose.yml` so any committed state can be recovered to a specific point in time.

## What's enabled

`docker-compose.yml` postgres service:

```yaml
command:
  - postgres
  - -c
  - wal_level=replica
  - -c
  - archive_mode=on
  - -c
  - archive_command=test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f
  - -c
  - max_wal_senders=2
volumes:
  - postgres_wal_archive:/var/lib/postgresql/wal_archive
```

- **`archive_mode=on`** turns on WAL archiving. Postgres calls `archive_command` for each completed WAL segment.
- **`archive_command`** copies the segment to `/var/lib/postgresql/wal_archive/`. The `test ! -f` guard refuses to overwrite an existing archive — the canonical safe form per the PG docs.
- **`postgres_wal_archive` volume** is the persistent archive store. Survives container restart + recreation.
- **`wal_level=replica`** is unchanged from the prior default (sufficient for PITR).
- **`max_wal_senders=2`** is set so a future replica or pg_basebackup taken from this node can stream WAL.

## Disk-space expectations

- WAL segments are 16 MB each. Postgres archives a segment when it fills, every `archive_timeout` (default off — segments archive only when full) or on `pg_switch_wal()` calls.
- On this workload (kline ingest + sporadic user writes) expect roughly **10–50 MB/day** of archive churn. Inspect with `docker exec marketmind-postgres du -sh /var/lib/postgresql/wal_archive`.
- **No automatic prune** — the archive grows indefinitely. Add a weekly cron (host side):
  ```bash
  docker exec marketmind-postgres find /var/lib/postgresql/wal_archive -type f -mtime +30 -delete
  ```
  Suggested retention: 30 days. Adjust to taste.

## Taking a base backup

A WAL archive is only useful for PITR if you also have a base backup to start from. Take one weekly (or before any risky migration):

```bash
docker exec -t marketmind-postgres pg_basebackup \
  -U "${DATABASE_USER:-marketmind}" \
  -D /var/lib/postgresql/basebackup-$(date +%Y%m%d) \
  -F tar -z -X stream -P -v
```

Move the resulting tarball off-host (S3, B2, NAS, etc.). Without this, WAL archiving is half a recovery story.

## Recovery walk-through (the user_layouts case)

This is the recipe we'd follow if the 2026-04-30 layout-overwrite had happened post-WAL-archive.

1. **Identify the cutoff time.** From `user_layouts_audit` (V1_5 B.2) find the offending write:
   ```sql
   SELECT id, user_id, source, ts, prev_data_hash, new_data_hash
   FROM user_layouts_audit
   WHERE user_id = '<user-id>'
   ORDER BY ts DESC
   LIMIT 20;
   ```
   The bad row is the one whose `new_data_hash` is the default-state hash. Recover to **just before** its `ts`.

2. **Stop the running server**. PITR requires a fresh data directory.
   ```bash
   docker compose stop backend
   ```

3. **Spin up a recovery instance** in a sibling directory. Don't touch the live volume.
   ```bash
   docker run --rm -d \
     --name marketmind-postgres-recovery \
     -v postgres_basebackup_20260428:/var/lib/postgresql/data \
     -v marketmind_postgres_wal_archive:/var/lib/postgresql/wal_archive:ro \
     -e POSTGRES_PASSWORD=recovery \
     -p 55432:5432 \
     timescale/timescaledb:latest-pg17 \
     postgres -c restore_command='cp /var/lib/postgresql/wal_archive/%f %p' \
              -c recovery_target_time='2026-04-30 14:46:00 UTC'
   ```
   `recovery_target_time` is the cutoff from step 1, minus a second.

4. **Verify the row** on the recovery instance:
   ```bash
   psql -h localhost -p 55432 -U marketmind -d marketmind \
     -c "SELECT data FROM user_layouts WHERE user_id = '<user-id>';"
   ```

5. **Copy the recovered data into the live DB** (carefully — this is a write):
   ```bash
   psql -h localhost -p 55432 -U marketmind -d marketmind \
     -c "COPY (SELECT data FROM user_layouts WHERE user_id = '<user-id>') TO STDOUT" \
     | psql -h localhost -p 5432 -U marketmind -d marketmind \
       -c "UPDATE user_layouts SET data = pg_read_binary_file('/dev/stdin')::text WHERE user_id = '<user-id>'"
   ```
   In practice, easier to `\copy` to a tempfile, eyeball it, then `UPDATE ... SET data = '<eyeballed-payload>' WHERE user_id = ...`.

6. **Tear down the recovery instance**.
   ```bash
   docker stop marketmind-postgres-recovery
   ```

7. **Restart backend**.
   ```bash
   docker compose start backend
   ```

## What this doesn't cover

- **Catastrophic loss of the WAL archive volume itself.** Mirror it off-host (S3 + lifecycle, or rsync to a NAS) for real disaster recovery. The current setup protects against application bugs, not host loss.
- **Logical corruption that flushes through to the archive before detection.** PITR moves you to a chosen wall-clock time; if the corruption happened gradually and you don't notice for a week, you'll lose a week of legitimate writes too. This is why the V1_5 B.1/B.2 snapshot + audit-log layers exist alongside this — they're cheaper to use for the common case.
- **Schema migrations.** PITR replays everything including schema changes. If you recover to before a recent migration, the on-disk state is the pre-migration shape; you'll need to re-run migrations after.

## Quick reference

| Task | Command |
|---|---|
| Inspect archive size | `docker exec marketmind-postgres du -sh /var/lib/postgresql/wal_archive` |
| Force-rotate a WAL segment | `docker exec marketmind-postgres psql -U marketmind -c "SELECT pg_switch_wal();"` |
| Verify archiving is healthy | `docker exec marketmind-postgres psql -U marketmind -c "SELECT * FROM pg_stat_archiver;"` |
| Prune archives >30 days old | `docker exec marketmind-postgres find /var/lib/postgresql/wal_archive -type f -mtime +30 -delete` |
| Take a base backup | See the `pg_basebackup` command above |
