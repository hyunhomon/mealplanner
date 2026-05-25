import type { EntityId, ISODateString } from "./api";

export type UserId = EntityId;

export interface User {
  id: UserId;
  email: string;
  displayName?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UpdateUserDto {
  displayName?: string;
}
