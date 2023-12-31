import { Router } from 'express';
import { jwtWithStaffAddress } from '../middleware/auth';
import { lookupLastOngoingIssuanceRun } from '../lib/ongoing';
import { lookupLastCheckForNewPOAPCodesRun } from '../lib/codes';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const vitalsRouter = Router();

vitalsRouter.get('/ongoing-issuance', jwtWithStaffAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  logger.info('Staff request for ongoing issuance vitals');

  const lastRun = await lookupLastOngoingIssuanceRun();

  logger.debug('Completed staff request for ongoing issuance vitals');

  return res.status(200).send({ lastRun });
});

vitalsRouter.get('/check-for-codes', jwtWithStaffAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  logger.info('Staff request for new code checking vitals');

  const lastRun = await lookupLastCheckForNewPOAPCodesRun();

  logger.debug('Completed staff request for new code checking vitals');

  return res.status(200).send({ lastRun });
});
