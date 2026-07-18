import { buildServer } from "./server.js";

const port = Number(process.env.PORT) || 3000;

buildServer().then((app) =>
  app.listen({ port, host: "0.0.0.0" }).then(() => {
    console.log(`PropOS API + portal running at http://localhost:${port}`);
    console.log(`Agent studio at http://localhost:${port}/studio`);
  }),
);
