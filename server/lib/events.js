import { EventEmitter } from 'node:events';

// Services emit here AFTER their transaction commits.
// Lane C subscribes in realtime/ and forwards to Socket.IO:
//   bus.on('session:status',   ({ sessionId, status, session }) => ...)
//   bus.on('credits:updated',  ({ userId }) => ...)
export const bus = new EventEmitter();
