import { EventEmitter } from "events";

const globalForEmitter = globalThis as unknown as {
  leadsEmitter: EventEmitter | undefined;
};

export const leadsEmitter =
  globalForEmitter.leadsEmitter ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    return emitter;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.leadsEmitter = leadsEmitter;
}

export const LEAD_ASSIGNED_EVENT = "lead:assigned";
export const QUOTA_RESET_EVENT = "quota:reset";
