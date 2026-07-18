import { buildServer } from "./server.js";

const port = Number(process.env.PORT) || 3000;
const app = buildServer();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`PropOS API + demo dashboard running at http://localhost:${port}`);
});
