# Public API

## Version 1

**Note that the public API limits individual IPs to a
maximum of 100 requests within a 5 minute window.**

### `GET /v1/poap/:poapTokenId/is-gitpoap`

This endpoint allows users to query whether some `poapTokenId` is a GitPOAP or not.
In the case that the `poapTokenId` corresponds to some claimed GitPOAP, the API will return
something like:

```json
{
  "isGitPOAP": true,
  "gitPOAPId": 4003
}
```

And in the case that it is not a GitPOAP:

```json
{
  "isGitPOAP": false
}
```

### `GET /v1/poap-event/:poapEventId/is-gitpoap`

This endpoint allows users to query whether some `poapEventId` is for GitPOAP project
contribution level. In the case that the `poapEventId` is for a GitPOAP project contribution
level, it will return something like:

```json
{
  "isGitPOAP": true,
  "gitPOAPId": 3001
}
```

And in the case that it is not a GitPOAP project contribution level:

```json
{
  "isGitPOAP": false
}
```

### `GET /v1/address/:address/gitpoaps`

This endpoint allows users to query for some address's (either and ETH or ENS
address) GitPOAPs. This returns data like:

```json
[
  {
    "gitPoapId": 34,
    "poapTokenId": "2432",
    "poapEventId": 343,
    "name": "GitPOAP: gitpoap-docs Level 2 Contributor 2022",
    "year": 2022,
    "description": "You've made at least 5 contributions to the gitpoap-docs project in 2022!",
    "imageUrl": "https://assets.poap.xyz/gitpoap-2022-devconnect-hackathon-gitpoap-team-contributor-2022-logo-1650466033470.png",
    "repository": "gitpoap/gitpoap-docs",
    "earnedAt": "2022-04-25",
    "createdAt": "2022-05-22"
  }
]
```