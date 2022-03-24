import { DateTime } from 'luxon';
import express from 'express';
import fetch from 'cross-fetch';
import { z } from 'zod';
import * as events from './data';
import { POAPEvent } from './poap';
import winston from 'winston';
import multer from 'multer';
import { extname } from 'path';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [fake-poap-api] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

const app = express();
const port = 4004;

const UPLOAD_FOLDER = <string>process.env.UPLOAD_FOLDER;
app.use('/public', express.static(UPLOAD_FOLDER));

let eventsCache: Record<string, any> = {
  1: events.event1,
  2: events.event2,
  3: events.event3,
  27309: events.event27309,
  27307: events.event27307,
  27305: events.event27305,
  25149: events.event25149,
  19375: events.event19375,
  29009: events.event29009,
};
let nextEventId = 900000;

let tokensCache: Record<string, any> = {
  4082459: {
    event: events.event27309, // you've met burz
    owner: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D', // peebeejay.eth
    tokenId: '4082459',
    chain: 'xdai',
    created: '2022-03-14',
  },
  3217451: {
    event: events.event19375, // gitpoap test (REAL POAP)
    owner: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D', // peebeejay.eth
    tokenId: '3217451',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4078452: {
    event: events.event25149, // you've met patricio
    owner: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D', // peebeejay.eth
    tokenId: '4078452',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4068606: {
    event: events.event27305, // you've met colfax
    owner: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D', // peebeejay.eth
    tokenId: '4068606',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4068504: {
    event: events.event27307, // you've met jay
    owner: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D', // peebeejay.eth
    tokenId: '4068504',
    chain: 'xdai',
    created: '2022-03-14',
  },
};
let nextTokenId = 100000000;

app.use(express.json());

async function validateAuth(req: express.Request) {
  const authorization = req.get('Authorization');
  if (!authorization) {
    return false;
  }

  if (authorization.substr(0, 7) !== 'Bearer ') {
    return false;
  }

  const token = authorization.substr(7);

  try {
    const authResponse = await fetch(`http://fake-poap-auth:4005/validate/${token}`);

    if (authResponse.status >= 400) {
      logger.error(`Failed to validate auth token: ${await authResponse.text()}`);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`Failed to validate auth token: ${err}`);
    return false;
  }
}

// Everything is a string since it's from multipart
const CreateEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  city: z.string(),
  country: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  expiry_date: z.string(),
  year: z.string(),
  event_url: z.string(),
  virtual_event: z.string(),
  secret_code: z.string(),
  event_template_id: z.string(),
  email: z.string(),
  requested_codes: z.string(),
  private_event: z.string(),
});

const storage = multer.diskStorage({
  destination: UPLOAD_FOLDER,
  filename: (req, file, cb) => {
    return cb(null, Date.now() + extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post('/events', upload.single('image'), async (req, res) => {
  logger.info('Received POST /events request');

  const schemaResult = CreateEventSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }
  if (!req.file) {
    return res.status(400).send({ msg: 'Missing image field' });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  const eventId = nextEventId++;

  const event = {
    id: eventId,
    fancy_id: 'string',
    name: req.body.name,
    event_url: req.body.event_url,
    image_url: `http://localhost:4004/public/${req.file.filename}`,
    country: req.body.country,
    city: req.body.city,
    description: req.body.description,
    year: parseInt(req.body.year, 10),
    start_date: req.body.start_date,
    end_date: req.body.end_date,
    expiry_date: req.body.expiry_date,
    created_date: DateTime.now().toFormat('yyyy-MM-dd'),
    from_admin: false,
    virtual_event: req.body.virtual_date === 'true',
    event_template_id: parseInt(req.body.event_template_id, 10),
    event_host_id: 0,
    private_event: req.body.private_event === 'true',
  };

  res.setHeader('Content-Type', 'application/json');

  eventsCache[eventId.toString()] = event;

  res.end(JSON.stringify(event));
});

app.get('/actions/scan/:address', async (req, res) => {
  logger.info(`Received GET /actions/scan/${req.params.address} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify([
      {
        event: events.event1,
        tokenId: 'thunderdome',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-02',
      },
      {
        event: events.event2,
        tokenId: 'ethdenver',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-01',
      },
      {
        event: events.event3,
        tokenId: 'pizza-pie',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-03-01',
      },
      {
        event: events.event27309,
        tokenId: '4082459',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-01',
      },
      {
        event: events.event27307,
        tokenId: '4068504',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-01',
      },
      {
        event: events.event27305,
        tokenId: '4068606',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-03',
      },
      {
        event: events.event25149,
        tokenId: '4078452',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-02',
      },
    ]),
  );
});

app.get('/events/id/:id', async (req, res) => {
  logger.info(`Received a GET /events/id/${req.params.id} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.params.id in eventsCache) {
    res.end(JSON.stringify(eventsCache[req.params.id]));
  } else {
    res.status(404).send(`ID ${req.params.id} NOT FOUND`);
  }
});

const ClaimQRSchema = z.object({
  address: z.string(),
  qr_hash: z.string(),
  secret: z.string(),
});

app.post('/actions/claim-qr', async (req, res) => {
  logger.info('Received POST /actions/claim-qr request');

  const schemaResult = ClaimQRSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  const today = DateTime.now().toFormat('yyyy-MM-dd');

  const token = {
    id: (nextTokenId++).toString(),
    qr_hash: req.body.qr_hash,
    queue_uid: 'string',
    event_id: 1,
    beneficiary: req.body.address,
    user_input: 'string',
    signer: 'burz.eth',
    claimed: true,
    claimed_date: today,
    created_date: today,
    is_active: true,
    event: events.event1,
    delegated_mint: true,
    delegated_signed_message: 'string',
  };

  tokensCache[token.id] = token;

  res.end(JSON.stringify(token));
});

app.get('/token/:id', async (req, res) => {
  logger.info(`Received a GET /token/${req.params.id} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.params.id in tokensCache) {
    res.end(JSON.stringify(tokensCache[req.params.id]));
  } else {
    // default
    res.end(
      JSON.stringify({
        event: events.event29009,
        tokenId: req.params.id,
        owner: '0x206e554084BEeC98e08043397be63C5132Cc01A1',
        chain: 'xdai',
        created: '2022-03-14',
      }),
    );
  }
});

const RedeemRequestsSchema = z.object({
  event_id: z.number(),
  requested_codes: z.number(),
  secret_code: z.string(),
  redeem_type: z.string(),
});

app.post('/redeem-requests', async (req, res) => {
  logger.info('Received POST /redeem-requests request');

  const schemaResult = RedeemRequestsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  return res.status(200).send('324324');
});

app.listen(port, () => {
  logger.info(`fake-poap-api listening on port ${port}`);
});
