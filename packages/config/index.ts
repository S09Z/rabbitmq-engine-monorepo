export const config = {
  rabbitUrl: process.env.RABBIT_URL!,
  rabbitMgmtUrl: process.env.RABBITMQ_MGMT_URL ?? "http://localhost:15672",
  rabbitMgmtUser: process.env.RABBITMQ_MGMT_USER ?? "admin",
  rabbitMgmtPass: process.env.RABBITMQ_MGMT_PASS ?? "admin123",
};
