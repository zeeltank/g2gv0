import { dbQuery } from "../datasource/mariadb.ts";

export async function executeQuery(sql: string) {
  return dbQuery(sql);
}
