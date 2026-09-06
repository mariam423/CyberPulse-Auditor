#!/usr/bin/env node
import { printBanner } from '../src/util/banner.js';
import { buildProgram } from '../src/cli/program.js';
// Print banner on every invocation
printBanner();
const program = buildProgram();
program.parse(process.argv);
//# sourceMappingURL=cyberpulse.js.map