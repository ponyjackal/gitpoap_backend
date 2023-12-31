import { utils } from 'ethers';
import { DateTime } from 'luxon';
import { SIGNATURE_TTL_DAYS } from '../constants';
import { createScopedLogger } from '../logging';
import { SignatureDataSchema } from '../schemas/signatures';
import { z } from 'zod';

type SignatureData = {
  message: string;
  createdAt: number;
};

export function isSignatureValid(
  address: string,
  signatureData: SignatureData,
  signature: string,
): boolean {
  const logger = createScopedLogger('isSignatureValid');

  const createdAt = DateTime.fromSeconds(signatureData.createdAt / 1000.0);

  if (createdAt.plus({ days: SIGNATURE_TTL_DAYS }) < DateTime.now()) {
    logger.debug('Rejected expired signature');
    return false;
  }

  try {
    const recoveredAddress = utils.verifyMessage(signatureData.message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (err) {
    logger.warn(`Rejected invalid signature related to address: ${address}`);
    return false;
  }
}

export const isAuthSignatureDataValid = (
  address: string,
  { createdAt, message, signature }: z.infer<typeof SignatureDataSchema>,
): boolean => isSignatureValid(address, { message, createdAt }, signature);
