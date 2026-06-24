import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  LedgerSnapshot,
  SettlementRecord,
  ViewerAuthorization,
  ViewerSession
} from "../domain/sessions.js";

export interface LedgerStore {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markProcessedEvent(eventId: string): Promise<void>;
  upsertAuthorization(authorization: ViewerAuthorization): Promise<void>;
  getAuthorization(viewerUserId: string): Promise<ViewerAuthorization | undefined>;
  appendSettlement(settlement: SettlementRecord): Promise<void>;
  upsertSession(session: ViewerSession): Promise<void>;
  getSession(viewerUserId: string): Promise<ViewerSession | undefined>;
  listOpenSessions(streamId?: string): Promise<ViewerSession[]>;
  snapshot(): Promise<LedgerSnapshot>;
}

interface SqliteRow {
  value: string;
}

function sqliteRows(rows: unknown): SqliteRow[] {
  return rows as SqliteRow[];
}

export class SqliteLedgerStore implements LedgerStore {
  private readonly db: DatabaseSync;

  constructor(private readonly filePath: string) {
    if (filePath !== ":memory:") {
      mkdirSync(dirname(filePath), { recursive: true });
    }

    this.db = new DatabaseSync(filePath);
    this.migrate();
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const row = this.db
      .prepare("select event_id from processed_events where event_id = ?")
      .get(eventId);

    return Boolean(row);
  }

  async markProcessedEvent(eventId: string): Promise<void> {
    this.db
      .prepare("insert or ignore into processed_events (event_id) values (?)")
      .run(eventId);
  }

  async upsertAuthorization(authorization: ViewerAuthorization): Promise<void> {
    this.db
      .prepare(
        `insert into authorizations (viewer_user_id, value)
         values (?, ?)
         on conflict(viewer_user_id) do update set value = excluded.value`
      )
      .run(authorization.viewerUserId, JSON.stringify(authorization));
  }

  async getAuthorization(
    viewerUserId: string
  ): Promise<ViewerAuthorization | undefined> {
    const row = this.db
      .prepare("select value from authorizations where viewer_user_id = ?")
      .get(viewerUserId) as SqliteRow | undefined;

    return row ? (JSON.parse(row.value) as ViewerAuthorization) : undefined;
  }

  async appendSettlement(settlement: SettlementRecord): Promise<void> {
    this.db
      .prepare("insert into settlements (id, value) values (?, ?)")
      .run(settlement.id, JSON.stringify(settlement));
  }

  async upsertSession(session: ViewerSession): Promise<void> {
    this.db
      .prepare(
        `insert into sessions (viewer_user_id, value)
         values (?, ?)
         on conflict(viewer_user_id) do update set value = excluded.value`
      )
      .run(session.viewerUserId, JSON.stringify(session));
  }

  async getSession(viewerUserId: string): Promise<ViewerSession | undefined> {
    const row = this.db
      .prepare("select value from sessions where viewer_user_id = ?")
      .get(viewerUserId) as SqliteRow | undefined;

    return row ? (JSON.parse(row.value) as ViewerSession) : undefined;
  }

  async listOpenSessions(streamId?: string): Promise<ViewerSession[]> {
    const snapshot = await this.snapshot();
    return snapshot.sessions.filter((session) => {
      const isOpen = !session.settled && session.status !== "settled";
      const matchesStream = streamId ? session.streamId === streamId : true;

      return isOpen && matchesStream;
    });
  }

  async snapshot(): Promise<LedgerSnapshot> {
    const processedEventRows = sqliteRows(
      this.db
        .prepare("select event_id as value from processed_events order by created_at")
        .all()
    );
    const authorizationRows = sqliteRows(this.db
      .prepare("select value from authorizations order by viewer_user_id")
      .all());
    const settlementRows = sqliteRows(this.db
      .prepare("select value from settlements order by created_at")
      .all());
    const sessionRows = sqliteRows(this.db
      .prepare("select value from sessions order by viewer_user_id")
      .all());

    return {
      processedEventIds: processedEventRows.map((row) => row.value),
      authorizations: authorizationRows.map(
        (row) => JSON.parse(row.value) as ViewerAuthorization
      ),
      settlements: settlementRows.map(
        (row) => JSON.parse(row.value) as SettlementRecord
      ),
      sessions: sessionRows.map((row) => JSON.parse(row.value) as ViewerSession)
    };
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists processed_events (
        event_id text primary key,
        created_at text not null default current_timestamp
      );

      create table if not exists authorizations (
        viewer_user_id text primary key,
        value text not null
      );

      create table if not exists sessions (
        viewer_user_id text primary key,
        value text not null
      );

      create table if not exists settlements (
        id text primary key,
        value text not null,
        created_at text not null default current_timestamp
      );
    `);
  }
}

const emptySnapshot = (): LedgerSnapshot => ({
  processedEventIds: [],
  authorizations: [],
  settlements: [],
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

  async appendSettlement(settlement: SettlementRecord): Promise<void> {
    await this.update((snapshot) => {
      snapshot.settlements.push(settlement);
    });
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
  private readonly settlements: SettlementRecord[] = [];
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

  async appendSettlement(settlement: SettlementRecord): Promise<void> {
    this.settlements.push(settlement);
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
      settlements: [...this.settlements],
      sessions: [...this.sessions.values()]
    };
  }
}
