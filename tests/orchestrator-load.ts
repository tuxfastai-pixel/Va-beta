import http from "k6/http";
import { sleep, check } from "k6";

/**
 * Load testing for orchestrator
 * Run with: k6 run tests/orchestrator-load.js --env CRON_SECRET=your_secret
 */

export const options = {
  vus: 1, // Start with 1 virtual user
  stages: [
    // Ramp-up: gradually increase to 20 VUs over 2 minutes
    { duration: "2m", target: 20 },
    // Spike: jump to 100 VUs
    { duration: "1m", target: 100 },
    // Soak: sustain 100 VUs for 5 minutes
    { duration: "5m", target: 100 },
    // Ramp-down: back to 0
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800", "p(99)<1000"], // 95% under 800ms
    http_req_failed: ["rate<0.01"], // Error rate < 1%
    "http_req_duration{staticAsset:yes}": ["p(99)<1000"], // Static content
  },
};

export default function () {
  const cronSecret = __ENV.CRON_SECRET || "test-secret";
  const baseUrl = "https://va-beta-two.vercel.app"; // Change to your URL

  // Call orchestrator endpoint
  const res = http.post(
    `${baseUrl}/api/run-orchestrator`,
    {},
    {
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      tags: { name: "orchestrator" },
    }
  );

  // Verify response
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 800ms": (r) => r.timings.duration < 800,
    "has success field": (r) => r.body.includes("success"),
    "no errors": (r) => !r.body.includes("error"),
  });

  sleep(1);
}

/**
 * Data fetching load test
 * Tests /api/escalation, /api/analytics/kpi, /api/portal
 */
export function DataFetchingLoadTest() {
  const options2 = {
    vus: 10,
    duration: "5m",
    thresholds: {
      http_req_duration: ["p(95)<500"],
      http_req_failed: ["rate<0.02"],
    },
  };

  const baseUrl = "https://va-beta-two.vercel.app";

  return function () {
    // Fetch escalation jobs
    const escalationRes = http.get(`${baseUrl}/api/escalation`, {
      tags: { name: "escalation" },
    });
    check(escalationRes, {
      "escalation status 200": (r) => r.status === 200,
    });

    // Fetch KPI metrics
    const kpiRes = http.get(`${baseUrl}/api/analytics/kpi`, {
      tags: { name: "kpi" },
    });
    check(kpiRes, {
      "kpi status 200": (r) => r.status === 200,
    });

    // Fetch portal
    const portalRes = http.get(`${baseUrl}/api/portal`, {
      tags: { name: "portal" },
    });
    check(portalRes, {
      "portal status 200": (r) => r.status === 200,
    });

    sleep(2);
  };
}

/**
 * Auto-apply concurrency test
 * Simulates race condition with rate limiting
 */
export function AutoApplyConcurrencyTest() {
  const options3 = {
    vus: 50, // 50 concurrent workers
    duration: "2m",
    thresholds: {
      http_req_failed: ["rate<0.01"],
    },
  };

  const baseUrl = "https://va-beta-two.vercel.app";
  const cronSecret = __ENV.CRON_SECRET || "test-secret";

  return function () {
    // All 50 workers hit orchestrator simultaneously
    const res = http.post(
      `${baseUrl}/api/run-orchestrator`,
      {},
      {
        headers: {
          "Authorization": `Bearer ${cronSecret}`,
        },
        tags: { name: "concurrent_orchestrator" },
      }
    );

    check(res, {
      "no race conditions": (r) => r.status === 200,
      "rate limit respected": (r) => !r.body.includes("rate limit exceeded"),
    });
  };
}
