import { Server } from "socket.io";
import * as bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { Set } from "immutable";
import { BehaviorSubject, Subscription } from "rxjs";

interface User {
  id: string;
  username: string;
  hashedPassword: string;
}

const users: User[] = [];
const loggedInSessions = new Map<string, { userId: string }>();
const queueSubject: BehaviorSubject<Set<string>> = new BehaviorSubject(Set());

bcrypt.hash("12345678", 10).then((hashedPassword) => {
  users.push({
    id: nanoid(),
    username: "kosmogradsky",
    hashedPassword,
  });
});

const io = new Server(8000, {
  transports: ["websocket"],
});

io.on("connection", (socket) => {
  const loggedInSessionIdSubject = new BehaviorSubject<string | null>(null);
  const queueTokenSubject = new BehaviorSubject<string | null>(null);
  let queueLengthSubscription: Subscription | null = null;
  let amInQueueSubscription: Subscription | null = null;
  let authStateSubscription: Subscription | null = null;

  socket.on(
    "sign in with username and password",
    async (
      username: string,
      password: string,
      respond: (response: any) => void
    ) => {
      const user = users.find((user) => user.username === username);

      if (user !== undefined) {
        if (await bcrypt.compare(password, user.hashedPassword)) {
          const sessionId = nanoid();
          loggedInSessions.set(sessionId, { userId: user.id });
          loggedInSessionIdSubject.next(sessionId);

          respond({
            sessionId,
          });
        }
      }
    }
  );

  socket.on(
    "sign in with session id",
    (sessionId: string, respond: (response: any) => void) => {
      const session = loggedInSessions.get(sessionId);

      if (session !== undefined) {
        loggedInSessionIdSubject.next(sessionId);

        respond({
          status: "ok",
        });
      }
    }
  );

  socket.on("sign out", (sessionId: string, respond: (response: any) => {}) => {
    loggedInSessions.delete(sessionId);
    loggedInSessionIdSubject.next(null);

    respond({
      status: "ok",
    });
  });

  socket.on("subscribe to queue length", () => {
    queueLengthSubscription = queueSubject.subscribe((queue) => {
      socket.emit("queue length changed", queue.size);
    });
  });

  socket.on("unsubscribe from queue length", () => {
    if (queueLengthSubscription !== null) {
      queueLengthSubscription.unsubscribe();
      queueLengthSubscription = null;
    }
  });

  socket.on("subscribe to am in queue", () => {
    amInQueueSubscription = queueTokenSubject.subscribe((queueToken) => {
      socket.emit("am in queue changed", queueToken !== null);
    });
  });

  socket.on("unsubscribe from am in queue", () => {
    if (amInQueueSubscription !== null) {
      amInQueueSubscription.unsubscribe();
      amInQueueSubscription = null;
    }
  });

  socket.on("subscribe to auth state", () => {
    authStateSubscription = loggedInSessionIdSubject.subscribe(
      (loggedInSessionId) => {
        if (loggedInSessionId === null) {
          socket.emit("auth state changed", { type: 0 });
        } else {
          const session = loggedInSessions.get(loggedInSessionId);

          if (session === undefined) {
            socket.emit("auth state changed", { type: 0 });
            console.log(
              "loggedInSessionId is defined but there's no corresponding session"
            );
          } else {
            const user = users.find((user) => user.id === session.userId);

            if (user === undefined) {
              socket.emit("auth state changed", { type: 0 });
              console.log(
                "loggedInSessionId is defined but there's no corresponding user"
              );
            } else {
              socket.emit("auth state changed", {
                type: 1,
                username: user.username,
              });
            }
          }
        }
      }
    );
  });

  socket.on("unsubscribe from auth state", () => {
    if (authStateSubscription !== null) {
      authStateSubscription.unsubscribe();
      authStateSubscription = null;
    }
  });

  socket.on("enter queue", () => {
    const loggedInSessionId = loggedInSessionIdSubject.getValue();

    if (loggedInSessionId !== null) {
      const session = loggedInSessions.get(loggedInSessionId);

      if (session !== undefined) {
        const currentQueueToken = queueTokenSubject.getValue();

        if (currentQueueToken === null) {
          const queueToken = nanoid();

          queueTokenSubject.next(queueToken);
          queueSubject.next(queueSubject.getValue().add(queueToken));
        }
      }
    }
  });

  socket.on("exit queue", () => {
    const loggedInSessionId = loggedInSessionIdSubject.getValue();

    if (loggedInSessionId !== null) {
      const session = loggedInSessions.get(loggedInSessionId);

      if (session !== undefined) {
        const queueToken = queueTokenSubject.getValue();

        if (queueToken !== null) {
          queueTokenSubject.next(null);
          queueSubject.next(queueSubject.getValue().remove(queueToken));
        }
      }
    }
  });
});
