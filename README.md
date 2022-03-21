# gitpoap-backend

## Resources

* https://www.pullrequest.com/blog/intro-to-using-typescript-in-a-nodejs-express-project/
* https://github.com/auth0/node-jsonwebtoken/
* https://github.com/auth0/express-jwt
* https://stackoverflow.com/questions/42406913/nodejs-import-require-conversion
* https://javascript.plainenglish.io/how-to-get-typescript-type-completion-by-defining-process-env-types-6a5869174f57
* https://stackoverflow.com/questions/66328425/jwt-argument-of-type-string-undefined-is-not-assignable-to-parameter-of-typ
* [prisma migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
* [relational queries (creation)](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#create-a-related-record)

## Running Locally with docker-compose

Example `.env`:
```sh
JWT_SECRET=yoyo

AWS_PROFILE=docker-agent

NODE_ENV=local

DATABASE_URL="postgresql://postgres:foobar88@localhost:5432"

POAP_API_URL="http://localhost:4004"
POAP_AUTH_URL="http://localhost:4005"
POAP_CLIENT_ID="a good client id"
POAP_CLIENT_SECRET="super secret!"

GITHUB_URL="https://github.com"
GITHUB_API_URL="https://api.github.com"

GITHUB_APP_CLIENT_ID="foobar"
GITHUB_APP_CLIENT_SECRET="whoville"
GITHUB_APP_REDIRECT_URL="http://localhost:3000/login"

REDIS_URL="redis://gitpoap-redis:ICanHazASecurePassword@localhost:6379"
```

### Entire Backend

To run all of the services (`fake-poap-api`, `fake-poap-auth`, `db`, `redis`, and `server`) locally
(with seeded data), we can run:
```sh
docker-compose up --build --force-recreate --renew-anon-volumes
```

### Everything but the Server

To run background services (`fake-poap-api`, `fake-poap-auth`, `db`, and `redis`), we can run:
```bash
docker-compose up --build --force-recreate --renew-anon-volumes db fake-poap-a{pi,uth} redis
```
then you can easily work on the backend API while making code changes locally (which will restart after any changes) via:
```sh
# First time to migrate and seed the DB:
./.dockerfiles/run-server.sh
# After we've already seeded the DB but want to restart the server for some reason:
yarn run dev
```

## Changing the Logging Level

You can change the logging level by specifying one option (`debug`, `info`, `warn`, `error`) to the `--level` option
on the command line. For example:
```sh
yarn run dev --level debug
```
