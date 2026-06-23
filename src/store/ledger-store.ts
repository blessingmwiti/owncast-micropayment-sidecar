import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  LedgerSnapshot,
  ViewerAuthorization,
  ViewerSession
} from "../domain/sessions.js";

export interface LedgerStore {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markProcessedEvent(eventId: string): Promise<void>;
  upsertAuthorization(authorization: ViewerAuthorization): Promise<void>;
  getAuthorization(viewerUserId: string): Promise<ViewerAuthorization | undefined>;
  upsertSession(session: ViewerSession): Promise<void>;
  getSession(viewerUserId: string): Promise<ViewerSession | undefined>;
  listOpenSessions(streamId?: string): Promise<ViewerSession[]>;
  snapshot(): Promise<LedgerSnapshot>;
}

const emptySnapshot = (): LedgerSnapshot => ({
  processedEventIds: [],
  authorizations: [],
  sessions: []
});

export class JsonLedgerStore implements LedgerStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const snapshot = await this.readSnapshot();
    return snapshot.processedEventIds.includes(eventId);
  }

  async markProcessedEvent(eventId: string): Promise<void> {
    await this.update((snapshot) => {
      if (!snapshot.processedEventIds.includes(eventId)) {
        snapshot.processedEventIds.push(eventId);
      }
    });
  }

  async upsertSession(session: ViewerSession): Promise<void> {
    await this.update((snapshot) => {
      const existingIndex = snapshot.sessions.findIndex(
        (item) => item.viewerUserId === session.viewerUserId
      );

      if (existingIndex >= 0) {
        snapshot.sessions[existingIndex] = session;
        return;
      }

      snapshot.sessions.push(session);
    });
  }

  async upsertAuthorization(authorization: ViewerAuthorization): Promise<void> {
    await this.update((snapshot) => {
      const existingIndex = snapshot.authorizations.findIndex(
        (item) => item.viewerUserId === authorization.viewerUserId
      );

      if (existingIndex >= 0) {
        snapshot.authorizations[existingIndex] = authorization;
        return;
      }

      snapshot.authorizations.push(authorization);
    });
  }

  async getAuthorization(
    viewerUserId: string
  ): Promise<ViewerAuthorization | undefined> {
    const snapshot = await this.readSnapshot();
    return snapshot.authorizations.find(
      (authorization) => authorization.viewerUserId === viewerUserId
    );
  }

  async getSession(viewerUserId: string): Promise<ViewerSession | undefined> {
    const snapshot = await this.readSnapshot();
    return snapshot.sessions.find((session) => session.viewerUserId === viewerUserId);
  }

  async listOpenSessions(streamId?: string): Promise<ViewerSession[]> {
    const snapshot = await this.readSnapshot();
    return snapshot.sessions.filter((session) => {
      const isOpen = !session.settled && session.status !== "settled";
      const matchesStream = streamId ? session.streamId === streamId : true;

      return isOpen && matchesStream;
    });
  }

  async snapshot(): Promise<LedgerSnapshot> {
    return this.readSnapshot();
  }

  private async update(mutator: (snapshot: LedgerSnapshot) => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const snapshot = await this.readSnapshot();
      mutator(snapshot);
      await this.writeSnapshot(snapshot);
    });

    await this.writeQueue;
  }

  private async readSnapshot(): Promise<LedgerSnapshot> {
    try {
      const file = await readFile(this.filePath, "utf8");
      return JSON.parse(file) as LedgerSnapshot;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return emptySnapshot();
      }

      throw error;
    }
  }

  private async writeSnapshot(snapshot: LedgerSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(tempPath, this.filePath);
  }
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly processedEventIds = new Set<string>();
  private readonly authorizations = new Map<string, ViewerAuthorization>();
  private readonly sessions = new Map<string, ViewerSession>();

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.processedEventIds.has(eventId);
  }

  async markProcessedEvent(eventId: string): Promise<void> {
    this.processedEventIds.add(eventId);
  }

  async upsertSession(session: ViewerSession): Promise<void> {
    this.sessions.set(session.viewerUserId, session);
  }

  async upsertAuthorization(authorization: ViewerAuthorization): Promise<void> {
    this.authorizations.set(authorization.viewerUserId, authorization);
  }

  async getAuthorization(
    viewerUserId: string
  ): Promise<ViewerAuthorization | undefined> {
    return this.authorizations.get(viewerUserId);
  }

  async getSession(viewerUserId: string): Promise<ViewerSession | undefined> {
    return this.sessions.get(viewerUserId);
  }

  async listOpenSessions(streamId?: string): Promise<ViewerSession[]> {
    return [...this.sessions.values()].filter((session) => {
      const isOpen = !session.settled && session.status !== "settled";
      const matchesStream = streamId ? session.streamId === streamId : true;

      return isOpen && matchesStream;
    });
  }

  async snapshot(): Promise<LedgerSnapshot> {
    return {
      processedEventIds: [...this.processedEventIds],
      authorizations: [...this.authorizations.values()],
      sessions: [...this.sessions.values()]
    };
  }
}
