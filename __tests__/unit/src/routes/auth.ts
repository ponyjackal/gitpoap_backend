import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { isAuthSignatureDataValid } from '../../../../src/lib/signatures';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { sign, verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';
import { removeGithubUsersGithubOAuthToken } from '../../../../src/lib/githubUsers';
import { removeGithubLoginForAddress } from '../../../../src/lib/addresses';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { DateTime } from 'luxon';
import { LOGIN_EXP_TIME_MONTHS } from '../../../../src/constants';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/signatures');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/githubUsers');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/external/github');

const mockedIsAuthSignatureDataValid = jest.mocked(isAuthSignatureDataValid, true);
const mockedIsGithubTokenValidForUser = jest.mocked(isGithubTokenValidForUser, true);
const mockedRemoveGithubUsersGithubOAuthToken = jest.mocked(
  removeGithubUsersGithubOAuthToken,
  true,
);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);

const authTokenId = 905;
const authTokenGeneration = 82;
const addressId = 22;
const address = '0xburzyBurz';
const addressLower = address.toLowerCase();
const ensName = null;
const ensAvatarImageUrl = null;
const signatureData = {
  signature: 'John Hancock',
  message: 'The pen is mightier than the sword',
  createdAt: 3423423425,
};
const githubUserId = 3233;
const githubId = 23422222;
const githubHandle = 'john-wayne-gacy';
const githubOAuthToken = 'im_super_spooky';
const emailId = 9884;

function validatePayloads(
  payload: string,
  expectedGithubId: number | null,
  expectedGithubHandle: string | null,
  expectedGeneration: number,
  expectedEmailId: number | null = null,
) {
  const { accessToken, refreshToken } = <UserAuthTokens>JSON.parse(payload);

  expect(getAccessTokenPayload(verify(accessToken, JWT_SECRET))).toEqual(
    expect.objectContaining({
      authTokenId,
      addressId,
      address: addressLower,
      ensName,
      ensAvatarImageUrl,
      githubId: expectedGithubId,
      githubHandle: expectedGithubHandle,
      emailId: expectedEmailId,
    }),
  );

  expect(getRefreshTokenPayload(verify(refreshToken, JWT_SECRET))).toEqual(
    expect.objectContaining({
      authTokenId,
      addressId,
      generation: expectedGeneration,
    }),
  );
}

describe('POST /auth', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth')
      .send({ address });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid signature', async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(false);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(401);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);
  });

  const expectAddressUpsert = () => {
    expect(contextMock.prisma.address.upsert).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.address.upsert).toHaveBeenCalledWith({
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
        email: {
          select: { id: true },
        },
      },
    });
  };

  it("Doesn't check GitHub login info when Address isn't associated with a User", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: null,
      email: null,
    } as any);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });

  it("Returns GitHub login info when user's login is still valid", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
      email: null,
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, githubId, githubHandle, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });

  it("Removes GitHub login info when user's login is invalid", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
      email: null,
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledWith(githubUserId);

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });
});

function genRefreshToken() {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
    null,
  ).refreshToken;
}

describe('POST /auth/refresh', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ tokn: 'foo' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid RefreshToken', async () => {
    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token: 'fooooooooo' });

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid RefreshTokenPayload', async () => {
    const token = sign({ foo: 'bar' }, JWT_SECRET);

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectAuthTokenLookup = () => {
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
      select: {
        createdAt: true,
        generation: true,
        address: {
          select: {
            id: true,
            ethAddress: true,
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
            email: {
              select: { id: true },
            },
          },
        },
      },
    });
  };

  it('Fails when AuthToken is not found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();
  });

  type MockAuthTokenExtras = {
    hasGithubUser?: boolean;
    hasEmail?: boolean;
  };

  const mockAuthTokenLookup = (
    createdAt: Date,
    generation: number,
    extras?: MockAuthTokenExtras,
  ) => {
    let githubUser = null;
    if (extras?.hasGithubUser) {
      githubUser = {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      };
    }
    let email = null;
    if (extras?.hasEmail) {
      email = { id: emailId };
    }

    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      createdAt,
      generation,
      address: {
        id: addressId,
        ethAddress: addressLower,
        ensName,
        ensAvatarImageUrl,
        githubUser,
        email,
      },
    } as any);
  };

  it('Fails when AuthToken generation is invalid', async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration + 2);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
    });
  });

  it('Fails when AuthToken is too old', async () => {
    mockAuthTokenLookup(
      DateTime.utc()
        .minus({ months: LOGIN_EXP_TIME_MONTHS + 1 })
        .toJSDate(),
      authTokenGeneration,
    );

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
    });
  });

  const expectAuthTokenUpdate = () => {
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
      data: {
        generation: { increment: 1 },
      },
      select: {
        generation: true,
      },
    });
  };

  it("Doesn't check GitHub login info when AuthToken isn't associated with a User", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });

  it("Returns GitHub login info when user's login is still valid", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, { hasGithubUser: true });
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, githubId, githubHandle, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(0);
  });

  it('Returns emailId when user has connected email', async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, { hasEmail: true });
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, nextGeneration, emailId);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(0);
  });

  it("Removes GitHub login info when user's login is invalid", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, { hasGithubUser: true });
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledWith(githubUserId);

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);
  });
});
