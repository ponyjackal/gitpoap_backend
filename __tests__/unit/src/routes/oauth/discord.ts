import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../../__mocks__/src/app';
import {
  requestDiscordOAuthToken,
  getDiscordCurrentUserInfo,
} from '../../../../../src/external/discord';
import {
  addDiscordLoginForAddress,
  removeDiscordLoginForAddress,
} from '../../../../../src/lib/addresses';
import { upsertDiscordUser } from '../../../../../src/lib/discordUsers';
import {
  generateAuthTokensWithChecks,
  updateAuthTokenGeneration,
} from '../../../../../src/lib/authTokens';
import { setupGenAuthTokens } from '../../../../../__mocks__/src/lib/authTokens';
import { MembershipAcceptanceStatus } from '@prisma/client';

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/discord');
jest.mock('../../../../../src/lib/discordUsers');
jest.mock('../../../../../src/lib/addresses');
jest.mock('../../../../../src/lib/authTokens', () => ({
  __esModule: true,
  ...(<any>jest.requireActual('../../../../../src/lib/authTokens')),
  generateAuthTokensWithChecks: jest.fn(),
  updateAuthTokenGeneration: jest.fn(),
}));

const mockedRequestDiscordOAuthToken = jest.mocked(requestDiscordOAuthToken, true);
const mockedGetDiscordCurrentUserInfo = jest.mocked(getDiscordCurrentUserInfo, true);
const mockedUpsertDiscordUser = jest.mocked(upsertDiscordUser, true);
const mockedAddDiscordLoginForAddress = jest.mocked(addDiscordLoginForAddress, true);
const mockedRemoveDiscordLoginForAddress = jest.mocked(removeDiscordLoginForAddress, true);
const mockedGenerateAuthTokensWithChecks = jest.mocked(generateAuthTokensWithChecks, true);
const mockedUpdateAuthTokenGeneration = jest.mocked(updateAuthTokenGeneration, true);

const authTokenId = 995;
const authTokenGeneration = 42;
const addressId = 322;
const address = '0xbArF00';
const ensName = null;
const ensAvatarImageUrl = null;
const code = '243lkjlkjdfs';
const discordTokenJson = {
  token_type: 'Bear',
  access_token: 'fooajldkfjlskj32f',
};
const discordToken = `${discordTokenJson.token_type} ${discordTokenJson.access_token}`;
const discordId = '2342';
const discordHandle = 'snoop-doggy-dog';
const discordUserId = 342444;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    address: {
      ensName,
      ensAvatarImageUrl,
      email: null,
      memberships: [],
    },
  } as any);
}

const genAuthTokens = setupGenAuthTokens({
  authTokenId,
  generation: authTokenGeneration,
  addressId,
  address,
  ensName,
  ensAvatarImageUrl,
  memberships: [],
  githubId: null,
  githubHandle: null,
  discordId,
  discordHandle,
  emailId: null,
});

describe('POST /oauth/discord', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp())
      .post('/oauth/discord')
      .send({ code });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid code', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockRejectedValue(new Error('error'));

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(400);

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);
  });

  it('Fails if current Discord user lookup fails', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockResolvedValue(discordTokenJson);
    mockedGetDiscordCurrentUserInfo.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(500);

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledWith(discordToken);
  });

  it('Returns UserAuthTokens on success', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockResolvedValue(discordTokenJson);
    mockedGetDiscordCurrentUserInfo.mockResolvedValue({
      id: discordId,
      username: discordHandle,
    } as any);
    const fakeDiscordUser = { id: discordUserId };
    mockedUpsertDiscordUser.mockResolvedValue(fakeDiscordUser as any);
    const nextGeneration = authTokenGeneration + 1;
    const fakeAddress = { is: 'fake' };
    mockedUpdateAuthTokenGeneration.mockResolvedValue({
      generation: nextGeneration,
      address: fakeAddress,
    } as any);
    mockedAddDiscordLoginForAddress.mockResolvedValue(undefined);
    const fakeAuthTokens = { accessToken: 'foo', refreshToken: 'bar' };
    mockedGenerateAuthTokensWithChecks.mockResolvedValue(fakeAuthTokens);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(fakeAuthTokens);

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledWith(discordToken);

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(discordId, discordHandle, discordToken);

    expect(mockedAddDiscordLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedAddDiscordLoginForAddress).toHaveBeenCalledWith(addressId, discordUserId);

    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledTimes(1);
    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledWith(authTokenId);

    expect(generateAuthTokensWithChecks).toHaveBeenCalledTimes(1);
    expect(generateAuthTokensWithChecks).toHaveBeenCalledWith(authTokenId, nextGeneration, {
      ...fakeAddress,
      id: addressId,
      ethAddress: address,
      discordUser: fakeDiscordUser,
    });
  });
});

describe('DELETE /oauth/discord', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp()).delete('/oauth/discord');

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid access token', async () => {
    const result = await request(await setupApp())
      .delete('/oauth/discord')
      .set('Authorization', `Bearer foo`);

    expect(result.statusCode).toEqual(400);
  });

  const expectAuthTokenFindUnique = () => {
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: { id: authTokenId },
      select: {
        id: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
            githubUser: {
              select: {
                githubId: true,
                githubHandle: true,
                githubOAuthToken: true,
              },
            },
            discordUser: {
              select: {
                discordId: true,
                discordHandle: true,
              },
            },
            email: {
              select: {
                id: true,
                isValidated: true,
              },
            },
            memberships: {
              where: {
                acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
              },
              select: {
                teamId: true,
                role: true,
              },
            },
          },
        },
      },
    });
  };
  it('Fails if no Discord user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: {
        ensName,
        ensAvatarImageUrl,
        email: null,
        discordUser: null,
        memberships: [],
      },
    } as any);

    const authTokens = genAuthTokens({ hasDiscord: false });

    const result = await request(await setupApp())
      .delete('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(400);

    expectAuthTokenFindUnique();
  });

  it('Succeeds if discord user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: {
        ensName,
        ensAvatarImageUrl,
        email: null,
        discordUser: {
          id: discordUserId,
          discordId,
          discordHandle,
        },
        memberships: [],
      },
    } as any);
    const nextGeneration = authTokenGeneration + 1;
    const fakeAddress = { wow: 'so fake' };
    mockedUpdateAuthTokenGeneration.mockResolvedValue({
      generation: nextGeneration,
      address: fakeAddress,
    } as any);
    const fakeAuthTokens = { accessToken: 'yeet', refreshToken: 'yolo' };
    mockedGenerateAuthTokensWithChecks.mockResolvedValue(fakeAuthTokens);

    const authTokens = genAuthTokens({ hasDiscord: true });

    const result = await request(await setupApp())
      .delete('/oauth/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(fakeAuthTokens);

    expectAuthTokenFindUnique();

    /* Expect that the token is updated to remove the user */
    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledTimes(1);
    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledWith(authTokenId);

    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledWith(addressId);

    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledWith(authTokenId, nextGeneration, {
      ...fakeAddress,
      id: addressId,
      ethAddress: address,
      discordUser: null,
    });
  });
});
