import { randomUUID } from "node:crypto";

/** Text primary keys. One place so a switch to cuid2/ulid is trivial. */
export const newId = (): string => randomUUID();
