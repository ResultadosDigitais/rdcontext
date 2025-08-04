import { db, library } from '../db';

export const list = async () => {
  return db.select().from(library);
};
