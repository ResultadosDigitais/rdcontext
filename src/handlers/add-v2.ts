import { embedNormalized, getCurrentProvider, getCurrentModel } from '../ai/embed';
import { extract } from '../ai/extract';
import * as libcontext from '../constants';
import { db, library } from '../db/schema-v2';
import { snippetStoreV2 } from '../db/snippet-store-v2';
import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';

const fromName = (lib: string): { owner: string; repo: string } => {
  const parts = lib.split('/');
  if (parts.length !== 2) {
    throw new Error('Library name must be in format owner/repo');
  }
  return { owner: parts[0].trim(), repo: parts[1].trim() };
};

const isDocumentationFile = (
  path: string,
  extensions: string[] = ['md', 'mdx'],
): boolean => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? extensions.includes(ext) : false;
};

const isInTargetFolders = (path: string, folders: string[] = []): boolean => {
  return (
    folders.length === 0 || folders.some((folder) => path.startsWith(folder))
  );
};

export interface AddOptions {
  name: string;
  branch?: string;
  tag?: string;
  folders?: string[];
  token?: string;
}

export const addV2 = async ({
  name,
  tag,
  branch,
  token,
  folders = [],
}: AddOptions) => {
  const { owner, repo } = fromName(name);
  const provider = getCurrentProvider();
  const model = getCurrentModel();

  console.log(`🚀 Indexing with ${provider} provider (${model}) - optimized 2025 architecture`);

  const github = new Octokit({
    userAgent: `${libcontext.name}/${libcontext.version}`,
    auth: token,
  });

  const {
    data: { description, default_branch },
  } = await github.repos.get({ owner, repo });
  const ref = tag ? `tags/${tag}` : `heads/${branch || default_branch}`;
  const libraryId = `${owner}/${repo}`;

  const {
    data: {
      object: { sha },
    },
  } = await github.git.getRef({
    owner,
    repo,
    ref,
  });

  const {
    data: { tree },
  } = await github.git.getTree({
    owner,
    repo,
    tree_sha: sha,
    recursive: 'true',
  });

  const files = tree
    .filter((item) => item.type === 'blob' && item.path)
    .filter((item) => isInTargetFolders(item.path, folders))
    .filter((item) => isDocumentationFile(item.path))
    .map(({ path, sha }) => ({
      libraryId,
      path,
      sha,
    }));

  console.log(`📁 Found ${files.length} documentation files`);

  // Batch file fetching with optimized error handling
  const BATCH_SIZE = 10;
  const allSnippets = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`📖 Processing files ${i + 1}-${Math.min(i + BATCH_SIZE, files.length)} of ${files.length}...`);

    const batchResults = await Promise.all(
      batch.map(async ({ path }) => {
        try {
          const { data } = await github.repos.getContent({
            owner,
            repo,
            ref,
            path,
          });

          if (Array.isArray(data) || data.type !== 'file') {
            console.warn(`⚠️  Skipping ${path}: Expected file but got ${Array.isArray(data) ? 'array' : data.type}`);
            return [];
          }

          const content =
            data.encoding === 'base64'
              ? Buffer.from(data.content, 'base64').toString('utf-8')
              : data.content;

          const snippets = await extract({
            name,
            description,
            path,
            content,
          });

          return snippets.map(snippet => ({
            ...snippet,
            path,
            library: name,
          }));
        } catch (error) {
          console.warn(`❌ Failed to process ${path}:`, error.message);
          return [];
        }
      }),
    );

    allSnippets.push(...batchResults.flat());
  }

  console.log(`🧠 Extracted ${allSnippets.length} snippets, generating normalized embeddings...`);

  // Generate embeddings with normalization (all will be 3072d)
  const EMBEDDING_BATCH_SIZE = 5;
  const snippetsWithEmbeddings = [];

  for (let i = 0; i < allSnippets.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = allSnippets.slice(i, i + EMBEDDING_BATCH_SIZE);
    console.log(`🔄 Generating embeddings ${i + 1}-${Math.min(i + EMBEDDING_BATCH_SIZE, allSnippets.length)} of ${allSnippets.length}...`);

    const batchWithEmbeddings = await Promise.all(
      batch.map(async (snippet) => {
        try {
          // Use normalized embedding (always 3072d regardless of provider)
          const embedding = await embedNormalized(
            `## ${snippet.title}\n\n${snippet.description}`,
          );
          return { ...snippet, embedding };
        } catch (error) {
          console.warn(`⚠️  Failed to generate embedding for "${snippet.title}":`, error.message);
          return null;
        }
      }),
    );

    snippetsWithEmbeddings.push(...batchWithEmbeddings.filter(Boolean));
  }

  console.log(`✅ Successfully processed ${snippetsWithEmbeddings.length} snippets with normalized embeddings`);

  console.log('🏗️  Building optimized index with sqlite-vec...');
  
  // Delete existing data first (outside transaction to avoid conflicts)
  try {
    await snippetStoreV2.deleteLibrarySnippets(name);
  } catch (error) {
    console.warn(`⚠️  Could not delete existing snippets for ${name}:`, error.message);
    // Continue anyway - this might be the first time adding this library
  }

  // Use transaction for library metadata only
  await db.transaction(async (tx) => {
    // Delete existing library record
    await tx.delete(library).where(eq(library.name, name));
    
    // Insert new library record with stats
    await tx.insert(library).values({
      name,
      owner,
      repo,
      folders,
      ref,
      sha,
      description,
      files: files.length,
      snippets: snippetsWithEmbeddings.length,
    });
  }, {
    behavior: 'deferred'  // Use deferred transaction to reduce locking
  });

  // Insert snippets using optimized sqlite-vec storage
  if (snippetsWithEmbeddings.length > 0) {
    await snippetStoreV2.insertSnippets(snippetsWithEmbeddings);
  }
  
  // Get final stats
  const stats = await snippetStoreV2.getLibraryStats(name);
  
  console.log(`🎉 Indexing complete!`);
  console.log(`   📊 Snippets: ${stats.totalSnippets}`);
  console.log(`   🤖 Provider: ${provider} (${model})`);
  console.log(`   📐 Dimensions: Original=${stats.avgEmbeddingDims}, Normalized=3072`);
  console.log(`   💾 Total vectors: ${stats.vectorCount}`);

  return { 
    snippets: snippetsWithEmbeddings.length,
    provider,
    model,
    originalDimensions: provider === 'gemini' ? 3072 : 1536,
    normalizedDimensions: 3072,
    files: files.length,
    stats,
  };
};