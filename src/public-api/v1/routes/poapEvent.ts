import { Router } from 'express';
import { context } from '../../../context';
import { retrievePOAPEventInfo } from '../../../external/poap';
import { GitPOAPStatus } from '@prisma/client';
import { getRequestLogger } from '../../../middleware/loggingAndTiming';

export const poapEventRouter = Router();

poapEventRouter.get('/:poapEventId/is-gitpoap', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info(
    `Request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: {
      poapEventId: parseInt(req.params.poapEventId, 10),
    },
    select: {
      id: true,
      poapApprovalStatus: true,
    },
  });

  logger.debug(
    `Completed request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  if (gitPOAP === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: gitPOAP.id,
    isDeprecated: gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED,
  });
});

poapEventRouter.get('/gitpoap-event-ids', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info('Request for all the POAP Event IDs that are GitPOAPs');

  // Note that we don't need to restrict to [APPROVED, REDEEM_REQUEST_PENDING], since
  // UNAPPROVED just means that the codes haven't been approved yet, the event still exists.
  // Presumably we will never run into a case where they don't approve our codes request
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      isEnabled: true,
    },
    select: {
      poapEventId: true,
    },
  });

  const results = gitPOAPs.map(g => g.poapEventId);

  logger.debug('Completed request for all the POAP Event IDs that are GitPOAPs');

  return res.status(200).send({ poapEventIds: results });
});

poapEventRouter.get('/gitpoap-event-fancy-ids', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info('Request for all the POAP Event Fancy IDs that are GitPOAPs');

  // Note that we don't need to restrict to [APPROVED, REDEEM_REQUEST_PENDING], since
  // UNAPPROVED just means that the codes haven't been approved yet, the event still exists.
  // Presumably we will never run into a case where they don't approve our codes request
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      isEnabled: true,
    },
    select: {
      id: true,
      poapEventId: true,
    },
  });

  const results: string[] = [];
  for (const gitPOAP of gitPOAPs) {
    const poapEventData = await retrievePOAPEventInfo(gitPOAP.poapEventId);
    if (poapEventData === null) {
      const msg = `Failed to retrieve POAP Event Info (ID: ${gitPOAP.poapEventId}) for GitPOAP ID ${gitPOAP.id}`;
      logger.error(msg);
      return res.status(500).send({ msg });
    }

    results.push(poapEventData.fancy_id);
  }

  logger.debug('Completed request for all the POAP Event Fancy IDs that are GitPOAPs');

  return res.status(200).send({ poapEventFancyIds: results });
});
