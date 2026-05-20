// Defensive: clear the prom-client default registry before each test file
// loads. fastify-metrics + business-metrics.ts register Counters on the
// shared singleton registry at module-load time, so any test file that
// builds the app — directly or transitively — would otherwise risk
// "metric already registered" errors when state leaks across files.
import { register } from "prom-client";

register.clear();
