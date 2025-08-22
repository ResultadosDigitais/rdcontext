import type { Command } from '../types';

export interface StartOptions {
  transport: 'stdio' | 'httpStream';
  port: number;
}

export const start: Command<StartOptions> = {
  command: 'start',
  description: 'Start the RDContext server',
  builder: (yargs) =>
    yargs
      .option('transport', {
        description: 'Transport type',
        alias: 't',
        default: 'stdio' as const,
        choices: ['stdio', 'httpStream'] as const,
      })
      .option('port', {
        description: 'Port for HTTP transport',
        alias: 'p',
        default: 3000,
        number: true,
      }),
  handler: async ({ transport, port }) => {
    const { server } = await import('../mcp/server');
    await server.start({ transportType: transport, httpStream: { port } });
  },
};
