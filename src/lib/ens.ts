import { utils } from 'ethers';
import { createScopedLogger } from '../logging';
import { context } from '../context';
import {
  resolveAddressInternal,
  resolveENSAvatarInternal,
  resolveENSInternal,
} from '../external/ens';
import { UploadFailureStatus, getS3URL, s3configProfile, uploadFileFromURL } from '../external/s3';
import { SECONDS_PER_HOUR } from '../constants';
import { upsertProfileForAddressId } from './profiles';
import { captureException } from './sentry';

const ENS_NAME_LAST_RUN_CACHE_PREFIX = 'ens#name-last-run';
const ENS_AVATAR_LAST_RUN_CACHE_PREFIX = 'ens#avatar-last-run';

// Assume that these change infrequently
const ENS_NAME_MAX_CHECK_FREQUENCY_HOURS = 12;
const ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS = 6;

export async function upsertENSNameInDB(ethAddress: string, ensName: string | null) {
  const logger = createScopedLogger('upsertENSNameInDB');

  if (!utils.isAddress(ethAddress)) {
    logger.error(`Invalid Ethereum address ${ethAddress}`);
    return null;
  }

  const ethAddressLower = ethAddress.toLowerCase();

  try {
    const existingAddress = await context.prisma.address.findUnique({
      where: { ethAddress: ethAddressLower },
      select: { id: true },
    });

    /* If an existing address is found, then update the ENS name. */
    if (existingAddress) {
      return await context.prisma.address.update({
        where: { id: existingAddress.id },
        data: { ensName },
      });
    }

    /* If no existing address is found, then create a new address with the ENS name. */
    const address = await context.prisma.address.upsert({
      where: { ethAddress: ethAddressLower },
      update: { ensName },
      create: { ethAddress: ethAddressLower, ensName },
    });

    await upsertProfileForAddressId(address.id);

    return address;
  } catch (e) {
    logger.error(`Error upserting ENS name ${ensName} for ${ethAddress}: ${e}`);
    captureException(e, { ethAddress, ensName });
    return null;
  }
}

async function upsertENSAvatarInDB(
  ethAddress: string,
  ensName: string,
  ensAvatarImageUrl: string | null,
) {
  const logger = createScopedLogger('upsertENSAvatarInDB');

  if (!utils.isAddress(ethAddress)) {
    logger.error(`Invalid Ethereum address ${ethAddress}`);
    return;
  }

  const ethAddressLower = ethAddress.toLowerCase();

  try {
    const existingAddress = await context.prisma.address.findUnique({
      where: { ethAddress: ethAddressLower },
      select: { id: true },
    });

    /* If an existing address is found, then update the ENS avatar. */
    if (existingAddress) {
      await context.prisma.address.update({
        where: { id: existingAddress.id },
        data: { ensAvatarImageUrl },
      });
      return;
    }

    /* If no existing address is found, then create a new address with the ENS avatar. */
    const address = await context.prisma.address.upsert({
      where: { ethAddress: ethAddressLower },
      update: { ensAvatarImageUrl },
      create: {
        ethAddress: ethAddressLower,
        ensName,
        ensAvatarImageUrl,
      },
    });

    await upsertProfileForAddressId(address.id);
  } catch (e) {
    logger.error(
      `Error upserting ENS avatar ${ensAvatarImageUrl} for ${ethAddress} (${ensName}): ${e}`,
    );
    captureException(e, { ethAddress, ensName, ensAvatarImageUrl });
    return;
  }
}

async function updateENSNameLastChecked(address: string) {
  void context.redis.setValue(
    ENS_NAME_LAST_RUN_CACHE_PREFIX,
    address.toLowerCase(),
    'checked',
    ENS_NAME_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );
}

async function updateENSName(address: string) {
  const logger = createScopedLogger('updateENSName');

  const addressLower = address.toLowerCase();

  const lastRunValue = await context.redis.getValue(ENS_NAME_LAST_RUN_CACHE_PREFIX, addressLower);
  if (lastRunValue !== null) {
    logger.debug(`Not enough time has elapsed to check for a new ENS name for ${address}`);
    return;
  }

  await updateENSNameLastChecked(addressLower);

  const ensName = await resolveAddressInternal(address);

  if (ensName !== null) {
    logger.info(`Stored ENS name ${ensName} for ${address}`);
  }

  await upsertENSNameInDB(address, ensName);

  return ensName;
}

export async function resolveENSAvatar(
  ensName: string,
  resolvedAddress: string,
  forceCheck = false,
) {
  const logger = createScopedLogger('resolveAvatar');

  if (!forceCheck) {
    const lastRunValue = await context.redis.getValue(ENS_AVATAR_LAST_RUN_CACHE_PREFIX, ensName);
    if (lastRunValue !== null) {
      logger.debug(`Not enough time has elapsed to check for new avatars for ${ensName}`);
      return;
    }
  }

  void context.redis.setValue(
    ENS_AVATAR_LAST_RUN_CACHE_PREFIX,
    ensName,
    'checked',
    ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );

  const addressLower = resolvedAddress.toLowerCase();

  let avatarURL = await resolveENSAvatarInternal(ensName);

  if (avatarURL !== null) {
    if (!avatarURL.startsWith('data:')) {
      const response = await uploadFileFromURL(
        avatarURL,
        s3configProfile.buckets.ensAvatarCache,
        addressLower, // Using ENS may cause issues (emoji ENSs/etc)
        true, // Make the image publicly accessible
      );

      if ('error' in response) {
        if (response.error === UploadFailureStatus.URLNotFound) {
          logger.warn(`ENS Avatar image at ${avatarURL} for ${ensName} returned HTTP status 404`);
          return;
        } else {
          logger.error(
            `Failed to upload ENS Avatar for ${ensName} at "${avatarURL}" to s3 cache for reason ${response.error}`,
          );
          return;
        }
      }

      avatarURL = getS3URL(s3configProfile.buckets.ensAvatarCache, addressLower);

      logger.info(`Cached ENS avatar in s3 for ${ensName}`);
    } else {
      logger.info(`Saved "data:*" URL with ENS avatar for "${ensName}"`);
    }
  }

  await upsertENSAvatarInDB(addressLower, ensName, avatarURL);
}

type ResolveExtraArgs = {
  forceAvatarCheck?: boolean;
  synchronous?: boolean;
};

/**
 * Resolve an ENS name to an ETH address.
 *
 * @param ensName - the ENS name to resolve
 *
 * @param resolveExtraArgs - extra arguments to control the resolution process
 * @param resolveExtraArgs.forceAvatarCheck - should the ENS avatar check be forced to run? (default: false)
 * @param resolveExtraArgs.synchronous - should the function wait to return until ENS name & avatar checks are done? (default: false)
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(
  ensName: string,
  resolveExtraArgs?: ResolveExtraArgs,
): Promise<string | null> {
  const result = await resolveENSInternal(ensName);

  if (result !== null && ensName.endsWith('.eth')) {
    // Run in the background
    const avatarPromise = resolveENSAvatar(ensName, result, resolveExtraArgs?.forceAvatarCheck);

    void updateENSNameLastChecked(result);
    const namePromise = upsertENSNameInDB(result, ensName);

    if (resolveExtraArgs?.synchronous) {
      await Promise.all([avatarPromise, namePromise]);
    }
  }

  return result;
}

/**
 * ENS Reverse Resolution - Resolve an ETH address to an ENS name
 *
 * @param address - the ETH address to resolve
 * @param forceAvatarCheck - should the ENS avatar check be forced to run? (default: false)
 * @param synchronous - should the function wait to return until ENS avatar checks are done? (default: false)
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddress(
  address: string,
  resolveExtraArgs?: ResolveExtraArgs,
): Promise<string | null> {
  const result = await context.prisma.address.findUnique({
    where: {
      ethAddress: address.toLowerCase(),
    },
    select: {
      ensName: true,
    },
  });

  const namePromise = updateENSName(address);

  if (result?.ensName) {
    const avatarPromise = resolveENSAvatar(
      result.ensName,
      address,
      resolveExtraArgs?.forceAvatarCheck,
    );

    if (resolveExtraArgs?.synchronous) {
      await Promise.all([namePromise, avatarPromise]);
    }

    return result.ensName;
  } else if (resolveExtraArgs?.synchronous) {
    await namePromise;
  }

  return null;
}
