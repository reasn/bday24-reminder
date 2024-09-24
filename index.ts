#!/usr/bin/env ts-node

import main from "./src/main";

import "dotenv/config";

main()
  .then(() => console.log("main() executed without error"))
  .catch((e) => console.error(e));
