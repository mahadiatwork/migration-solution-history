import { conn_name } from "./config";

test("uses the configured CRM connection", () => {
  expect(conn_name).toBe("crm_conn");
});
