#!/usr/bin/env node
import { createCli } from './cli/commands.js';

createCli().parse(process.argv);
