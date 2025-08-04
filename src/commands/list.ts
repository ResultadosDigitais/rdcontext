import { list as handler } from '../handlers/list';
import type { Command } from '../types';

export const list: Command = {
  command: 'list',
  description: 'List libraries added to the server',
  handler: async () => {
    const libraries = await handler();
    for (const library of libraries) {
      console.log(`- ${library.name}: ${library.description || library.name}`);
    }
  },
};
