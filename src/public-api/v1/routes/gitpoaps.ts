import { Router } from 'express';
import { context } from '../../../context';
import { ClaimStatus } from '@generated/type-graphql';
import { mapGitPOAPsToGitPOAPResults } from '../helpers';
import { getRequestLogger } from '../../../middleware/loggingAndTiming';

export const gitpoapsRouter = Router();

gitpoapsRouter.get('/:gitpoapId/addresses', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info(`Request to get all addresses that possess GitPOAP id ${req.params.gitpoapId}`);

  const gitPOAPId = parseInt(req.params.gitpoapId, 10);
  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
  });

  if (gitPOAP === null) {
    const msg = 'GitPOAP not found';
    logger.warn(msg);
    return res.status(404).send({ message: msg });
  }

  const claims = await context.prisma.claim.findMany({
    where: {
      gitPOAPId,
      mintedAddressId: {
        not: null,
      },
    },
    select: {
      mintedAddress: true,
    },
  });

  const mappedAddresses = claims.map(claim => claim.mintedAddress?.ethAddress);

  logger.info(
    `Completed request to get all addresses that possess GitPOAP id ${req.params.gitpoapId}`,
  );

  return res.status(200).send({ addresses: mappedAddresses });
});

gitpoapsRouter.get('/addresses', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info(`Request to get all addresses that possess any GitPOAP`);

  const claims = await context.prisma.claim.findMany({
    distinct: ['mintedAddressId'],
    where: {
      mintedAddressId: {
        not: null,
      },
    },
    select: {
      mintedAddress: true,
    },
  });

  const mappedAddresses = claims.map(claim => claim.mintedAddress?.ethAddress);

  logger.info(`Completed request to get all addresses that possess any GitPOAP`);

  return res.status(200).send({ addresses: mappedAddresses });
});

gitpoapsRouter.get('/events', async (req, res) => {
  const logger = getRequestLogger(req);

  logger.info('Request for all GitPOAP events');

  // Note that we don't need to restrict to [APPROVED, REDEEM_REQUEST_PENDING], since
  // UNAPPROVED just means that the codes haven't been approved yet, the event still exists.
  // Presumably we will never run into a case where they don't approve our codes request
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      isEnabled: true,
    },
    select: {
      id: true,
      poapApprovalStatus: true,
      poapEventId: true,
      project: {
        select: {
          repos: {
            select: {
              name: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      // Would have used _count but we can't have a where
      claims: {
        where: {
          status: ClaimStatus.CLAIMED,
        },
        select: {
          id: true,
        },
      },
    },
  });

  const results = await mapGitPOAPsToGitPOAPResults(gitPOAPs);

  if (results === null) {
    const msg = 'Failed to query POAP data for claims';
    logger.error(msg);
    return res.status(500).send({ msg });
  }

  logger.debug('Completed request for all GitPOAP events');

  return res.status(200).send({ gitPoapEvents: results });
});
