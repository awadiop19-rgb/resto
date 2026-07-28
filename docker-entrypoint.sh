#!/bin/sh
set -e

echo "Running Prisma migrations against $DATABASE_URL ..."
npx prisma migrate deploy

exec "$@"
