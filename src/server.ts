require('dotenv').config();

import express from 'express';
import cors from 'cors';
import subscribeRouter from './routes/subscribe';
import { suggestRouter } from './routes/suggest';
import jwtRouter from './routes/jwt';
import { githubRouter } from './routes/github';
import { claimsRouter } from './routes/claims';
import { CONTACTS_TABLE_NAME } from './libs/ddbClient';
import { PORT } from './constants';

const aws_profile = process.env.AWS_PROFILE as string;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello world.  -GitPOAP');
});

/* Endpoints */
app.use('/jwt', jwtRouter);
app.use('/subscribe', subscribeRouter);
app.use('/suggest', suggestRouter);
app.use('/github', githubRouter);
app.use('/claims', claimsRouter);

app.listen(PORT, () => {
  console.log(`The application is listening on port ${PORT}!\n`);

  const environment = process.env.NODE_ENV;
  const secret = process.env.JWT_SECRET;

  console.log('Environment: ', environment);
  console.log('Secret: ', secret);
  console.log('Contacts table: ', CONTACTS_TABLE_NAME);
  console.log('Using AWS Profile: ', aws_profile);
});
