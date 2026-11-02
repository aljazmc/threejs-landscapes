import { Main } from "./game/main";

/** Hull Breach: a first person shooter in three.js (see README.md). */
const root = document.getElementById("root");
if (root) void new Main(root).start();
