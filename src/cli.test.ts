import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { type MockResult, mockModule } from '../tests/utils';
import { cli } from './cli';

describe('cli', () => {
  let mocks: MockResult[] = [];

  afterEach(() => {
    mocks.forEach((mockResult) => mockResult.clear());
  });

  describe('add', () => {
    const add = mock(async () => ({ snippets: 10 }));

    beforeEach(async () => {
      mocks = [await mockModule('./handlers/add', () => ({ add }))];
    });

    it('should be a command', async () => {
      const name = 'cozmo-ai/rdcontext';
      await cli.parseAsync(['add', name]);
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ name }));
    });

    it('should check if name was provided', async () => {
      await cli.parseAsync(['add']);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('need at least 1'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should accept either a branch or a tag, but not both', async () => {
      await cli.parseAsync([
        'add',
        'cozmo-ai/rdcontext',
        '--branch',
        'main',
        '--tag',
        'v0.0.1',
      ]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('specify either --branch or --tag'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should accept arguments', async () => {
      await cli.parseAsync([
        'add',
        'cozmo-ai/rdcontext',
        '--folders',
        'docs/a',
        'docs/b',
        '--branch',
        'master',
        '--token',
        'ghp_qwer1234',
      ]);
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cozmo-ai/rdcontext',
          folders: ['docs/a', 'docs/b'],
          branch: 'master',
          token: 'ghp_qwer1234',
        }),
      );
    });
  });

  describe('get', () => {
    const get = mock(async () => []);

    beforeEach(async () => {
      mocks = [await mockModule('./handlers/get', () => ({ get }))];
    });

    it('should be a command', async () => {
      const name = 'cozmo-ai/rdcontext';
      const topic = 'how to add a library?';
      await cli.parseAsync(['get', name, topic]);
      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({ name, topic }),
      );
    });

    it('should check if name was provided', async () => {
      await cli.parseAsync(['get']);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('need at least 1'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should accept arguments', async () => {
      await cli.parseAsync([
        'get',
        'cozmo-ai/rdcontext',
        'how to add a library?',
        '--k',
        '20',
      ]);
      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cozmo-ai/rdcontext',
          topic: 'how to add a library?',
          k: 20,
        }),
      );
    });
  });

  describe('list', () => {
    const lib = {
      name: 'cozmo-ai/rdcontext',
      description:
        'Create your LLM context with documentation examples of libraries',
    };
    const list = mock(async () => [lib]);

    beforeEach(async () => {
      mocks = [await mockModule('./handlers/list', () => ({ list }))];
    });

    it('should be a command', async () => {
      await cli.parseAsync(['list']);
      expect(list).toHaveBeenCalled();
    });

    it('should list libs', async () => {
      await cli.parseAsync(['list']);
      expect(list).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(lib.name),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(lib.description),
      );
    });
  });

  describe('rm', () => {
    const rm = mock(async () => 1);

    beforeEach(async () => {
      mocks = [await mockModule('./handlers/rm', () => ({ rm }))];
    });

    it('should be a command', async () => {
      const name = 'cozmo-ai/rdcontext';
      await cli.parseAsync(['rm', name]);
      expect(rm).toHaveBeenCalledWith(expect.objectContaining({ name }));
    });

    it('should check if name was provided', async () => {
      await cli.parseAsync(['rm']);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('need at least 1'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
