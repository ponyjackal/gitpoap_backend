import { Router } from 'express';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { RefreshTokenPayload } from '../types/tokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { context } from '../context';
import { CreateAccessTokenSchema, RefreshAccessTokenSchema } from '../schemas/auth';
import { UserAuthTokens, generateAuthTokens, generateNewAuthTokens } from '../lib/authTokens';
import { resolveAddress, resolveENS } from '../lib/ens';
import { isSignatureValid } from '../lib/signatures';
import { z } from 'zod';
import { isGithubTokenValidForUser } from '../external/github';
import { removeUsersGithubOAuthToken } from '../lib/users';
import { removeGithubLoginForAddress } from '../lib/addresses';

export const authRouter = Router();

type GithubTokenData = {
  githubId: number | null;
  githubHandle: string | null;
};

async function getTokenDataWithGithubCheck(
  addressId: number,
  userId: number,
  githubId: number,
  githubHandle: string,
  githubOAuthToken: string | null,
): Promise<GithubTokenData> {
  const logger = createScopedLogger('getTokenDataWithGithubCheck');

  if (await isGithubTokenValidForUser(githubOAuthToken, githubId)) {
    return { githubId, githubHandle };
  }

  logger.info(`Removing invalid GitHub OAuth token for User ID ${userId}`);

  await removeUsersGithubOAuthToken(userId);

  await removeGithubLoginForAddress(addressId);

  return {
    githubId: null,
    githubHandle: null,
  };
}

authRouter.post('/', async function (req, res) {
  const logger = createScopedLogger('POST /auth');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/auth/refresh');

  const schemaResult = CreateAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address, signature } = <z.infer<typeof CreateAccessTokenSchema>>req.body;

  logger.info(`Request to create AuthToken for address ${address}`);

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(address);
  if (resolvedAddress === null) {
    const msg = `The address "${address}" is invalid`;
    logger.warn(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }

  // Pre-fetch ENS info if it doesn't already exist
  const ensPromise = resolveAddress(
    resolvedAddress,
    false, // Don't force a recheck of the ENS avatar if checked recently
    true, // Check for an ENS name and ENS avatar synchronously
  );

  // Validate signature
  if (
    !isSignatureValid(resolvedAddress, 'POST /auth', signature, {
      data: address,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const addressLower = resolvedAddress.toLowerCase();

  // Wait for the ENS resolution to finish
  await ensPromise;

  // If the resolveAddress promise found an Address or new ENS name
  // this will already exist
  const dbAddress = await context.prisma.address.upsert({
    where: {
      ethAddress: addressLower,
    },
    update: {},
    create: {
      ethAddress: addressLower,
    },
    select: {
      id: true,
      ensName: true,
      ensAvatarImageUrl: true,
      githubUser: {
        select: {
          id: true,
          githubId: true,
          githubHandle: true,
          githubOAuthToken: true,
        },
      },
    },
  });

  let githubTokenData: GithubTokenData = { githubId: null, githubHandle: null };
  if (dbAddress.githubUser !== null) {
    githubTokenData = await getTokenDataWithGithubCheck(
      dbAddress.id,
      dbAddress.githubUser.id,
      dbAddress.githubUser.githubId,
      dbAddress.githubUser.githubHandle,
      dbAddress.githubUser.githubOAuthToken,
    );
  }

  const userAuthTokens = generateNewAuthTokens(
    dbAddress.id,
    addressLower,
    dbAddress.ensName,
    dbAddress.ensAvatarImageUrl,
    githubTokenData.githubId,
    githubTokenData.githubHandle,
  );

  logger.debug(`Completed request to create AuthToken for address ${address}`);

  endTimer({ status: 200 });

  return res.status(200).send(userAuthTokens);
});

authRouter.post('/refresh', async function (req, res) {
  const logger = createScopedLogger('POST /auth/refresh');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/auth/refresh');

  const schemaResult = RefreshAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info('Request to refresh AuthToken');

  const { token } = req.body;

  let payload: RefreshTokenPayload;
  try {
    payload = <RefreshTokenPayload>verify(token, JWT_SECRET);
  } catch (err) {
    logger.warn('The refresh token is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  const authToken = await context.prisma.authToken.findUnique({
    where: {
      id: payload.authTokenId,
    },
    select: {
      generation: true,
      address: {
        select: {
          id: true,
          ethAddress: true,
          ensName: true,
          ensAvatarImageUrl: true,
        },
      },
      user: {
        select: {
          id: true,
          githubId: true,
          githubHandle: true,
          githubOAuthToken: true,
        },
      },
    },
  });

  if (authToken === null) {
    logger.warn('The refresh token is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  // If someone is trying to use an old generation of the refresh token, we must
  // consider the lineage to be tainted, and therefore purge it completely
  // (user will need to log back in via GitHub).
  if (payload.generation !== authToken.generation) {
    logger.warn(`Address ${authToken.address.ethAddress} had a refresh token reused.`);

    try {
      await context.prisma.authToken.delete({
        where: {
          id: payload.authTokenId,
        },
      });
    } catch (err) {
      logger.warn(`Tried to delete an AuthToken that was already deleted: ${err}`);
    }

    endTimer({ status: 401 });

    return res.status(401).send({ message: 'The refresh token has already been used' });
  }

  const nextGeneration = authToken.generation + 1;
  await context.prisma.authToken.update({
    where: {
      id: payload.authTokenId,
    },
    data: {
      generation: nextGeneration,
    },
  });

  let githubTokenData: GithubTokenData = { githubId: null, githubHandle: null };
  if (authToken.user !== null) {
    githubTokenData = await getTokenDataWithGithubCheck(
      authToken.address.id,
      authToken.user.id,
      authToken.user.githubId,
      authToken.user.githubHandle,
      authToken.user.githubOAuthToken,
    );
  }

  const userAuthTokens = generateAuthTokens(
    payload.authTokenId,
    nextGeneration,
    authToken.address.id,
    authToken.address.ethAddress,
    authToken.address.ensName,
    authToken.address.ensAvatarImageUrl,
    githubTokenData.githubId,
    githubTokenData.githubHandle,
  );

  logger.debug('Completed request to refresh AuthToken');

  endTimer({ status: 200 });

  return res.status(200).send(userAuthTokens);
});
