import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { createServer, IncomingMessage } from 'http';
import { createScopedLogger } from './logging';
import { parse } from 'url';
import { APP_NAME, NODE_ENV } from './environment';

const METRICS_PORT = 8080;

const register = new Registry();

register.setDefaultLabels({ app: APP_NAME });

collectDefaultMetrics({ register });

const server = createServer(async (req: IncomingMessage, res) => {
  if (req.url) {
    const route = parse(req.url).pathname;

    if (route === '/metrics') {
      res.setHeader('Content-Type', register.contentType);

      res.end(await register.metrics());
    }
  }
});

export function startMetricsServer() {
  const logger = createScopedLogger('startMetricsServer');

  logger.debug('Starting metrics server');

  server.listen(METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  });
}

const _httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_microseconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['stage', 'method', 'path', 'status'],
});
register.registerMetric(_httpRequestDurationSeconds);
export const httpRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _httpRequestDurationSeconds.startTimer();

    return (values: { status: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

const _gqlRequestDurationSeconds = new Histogram({
  name: 'gql_request_duration_seconds',
  help: 'Duration of GQL requests in seconds',
  labelNames: ['stage', 'request', 'success'],
});
register.registerMetric(_gqlRequestDurationSeconds);
export const gqlRequestDurationSeconds = {
  startTimer: (request: string) => {
    const endTimer = _gqlRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, request, ...values });
    };
  },
};

const _poapRequestDurationSeconds = new Histogram({
  name: 'poap_request_duration_seconds',
  help: 'Duration of POAP API requests in seconds',
  labelNames: ['stage', 'method', 'path', 'success'],
});
register.registerMetric(_poapRequestDurationSeconds);
export const poapRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _poapRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

const _mailChimpRequestDurationSeconds = new Histogram({
  name: 'mailchimp_request_duration_seconds',
  help: 'Duration of MailChimp API requests in seconds',
  labelNames: ['stage', 'method', 'path', 'success'],
});
register.registerMetric(_mailChimpRequestDurationSeconds);
export const mailChimpRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _mailChimpRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

const _ensRequestDurationSeconds = new Histogram({
  name: 'ens_request_duration_seconds',
  help: 'Duration of ENS requests in seconds',
  labelNames: ['stage', 'method'],
});
register.registerMetric(_ensRequestDurationSeconds);
export const ensRequestDurationSeconds = {
  startTimer: (method: string) => {
    const endTimer = _ensRequestDurationSeconds.startTimer();

    return () => {
      endTimer({ stage: NODE_ENV, method });
    };
  },
};

const _githubRequestDurationSeconds = new Histogram({
  name: 'github_request_duration_seconds',
  help: 'Duration of GitHub API requests in seconds',
  labelNames: ['stage', 'method', 'path', 'success'],
});
register.registerMetric(_githubRequestDurationSeconds);
export const githubRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _githubRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

export const _redisRequestDurationSeconds = new Histogram({
  name: 'redis_request_duration_seconds',
  help: 'Duration of redis requests in seconds',
  labelNames: ['stage', 'method'],
});
register.registerMetric(_redisRequestDurationSeconds);
export const redisRequestDurationSeconds = {
  startTimer: (method: string) => {
    const endTimer = _redisRequestDurationSeconds.startTimer();

    return () => {
      endTimer({ stage: NODE_ENV, method });
    };
  },
};

export const _ongoingIssuanceProjectDurationSeconds = new Histogram({
  name: 'ongoing_issuance_project_duration_seconds',
  help: 'Duration of the ongoing issuance batch process for a single project',
  labelNames: ['stage', 'project', 'success'],
});
register.registerMetric(_ongoingIssuanceProjectDurationSeconds);
export const ongoingIssuanceProjectDurationSeconds = {
  startTimer: (project: string) => {
    const endTimer = _ongoingIssuanceProjectDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, project, ...values });
    };
  },
};

export const _overallOngoingIssuanceDurationSeconds = new Histogram({
  name: 'overall_ongoing_issuance_duration_seconds',
  help: 'Duration of the overall ongoing issuance batch process',
  labelNames: ['stage', 'processed_count'],
});
register.registerMetric(_overallOngoingIssuanceDurationSeconds);
export const overallOngoingIssuanceDurationSeconds = {
  startTimer: () => {
    const endTimer = _overallOngoingIssuanceDurationSeconds.startTimer();

    return (values: { processed_count: number }) => {
      endTimer({ stage: NODE_ENV, ...values });
    };
  },
};

export const _pullRequestBackloadDurationSeconds = new Histogram({
  name: 'pull_request_backload_duration_seconds',
  help: 'Duration of the pull request backload process',
  labelNames: ['stage'],
});
register.registerMetric(_pullRequestBackloadDurationSeconds);
export const pullRequestBackloadDurationSeconds = {
  startTimer: () => {
    const endTimer = _pullRequestBackloadDurationSeconds.startTimer();

    return () => {
      endTimer({ stage: NODE_ENV });
    };
  },
};
