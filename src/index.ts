#!/usr/bin/env node

import { cli } from './cli';
import { migrate } from './db/migrations';

await migrate();

await cli.parseAsync();
