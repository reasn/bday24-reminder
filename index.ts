#!/usr/bin/env ts-node

import "dotenv/config";

import main from "./src/main";

main()
  .then(() => console.log("main() executed without error"))
  .catch((e) => console.error(e));
