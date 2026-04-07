import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { PineStrategy, PineStrategyMetadata } from './types';

const PINE_EXTENSION = '.pine';
const METADATA_REGEX = /^\/\/\s*@(\w+)\s+(.+)$/;
const PARAM_REGEX = /^\/\/\s*@param\s+(\w+)\s+(.+)$/;
const INPUT_INT_REGEX = /(\w+)\s*=\s*input\.int\(\s*(\d+)/g;
const INPUT_FLOAT_REGEX = /(\w+)\s*=\s*input\.float\(\s*([\d.]+)/g;

const parseMetadataLine = (
  line: string,
  metadata: Partial<PineStrategyMetadata>
): void => {
  const match = line.match(METADATA_REGEX);
  if (!match) return;

  const [, key, value] = match;
  const v = value!.trim();
  switch (key) {
    case 'id':
      metadata.id = v;
      break;
    case 'name':
      metadata.name = v;
      break;
    case 'version':
      metadata.version = v;
      break;
    case 'description':
      metadata.description = v;
      break;
    case 'author':
      metadata.author = v;
      break;
    case 'tags':
      metadata.tags = v.split(',').map((t) => t.trim());
      break;
    case 'status':
      metadata.status = v;
      break;
    case 'enabled':
      metadata.enabled = v === 'true';
      break;
    case 'strategyType':
      if (!metadata.filters) metadata.filters = {};
      metadata.filters.strategyType = v;
      break;
    case 'momentumType':
      if (!metadata.filters) metadata.filters = {};
      metadata.filters.momentumType = v;
      break;
    case 'volumeType':
      if (!metadata.filters) metadata.filters = {};
      metadata.filters.volumeType = v;
      break;
  }
};

const extractInputDefaults = (source: string): Record<string, number> => {
  const defaults: Record<string, number> = {};

  for (const match of source.matchAll(INPUT_INT_REGEX)) {
    defaults[match[1]!] = parseInt(match[2]!, 10);
  }
  for (const match of source.matchAll(INPUT_FLOAT_REGEX)) {
    defaults[match[1]!] = parseFloat(match[2]!);
  }

  return defaults;
};

const parseMetadata = (
  source: string,
  filePath: string
): PineStrategyMetadata => {
  const lines = source.split('\n');
  const metadata: Partial<PineStrategyMetadata> = {
    tags: [],
    parameters: {},
    filters: {},
  };

  for (const line of lines) {
    if (!line.startsWith('//')) {
      if (line.trim().length > 0 && !line.startsWith('//@version')) break;
      continue;
    }

    parseMetadataLine(line, metadata);

    const paramMatch = line.match(PARAM_REGEX);
    if (paramMatch) {
      const [, name, desc] = paramMatch;
      metadata.parameters![name!] = {
        default: 0,
        description: desc!.trim(),
      };
    }
  }

  const inputDefaults = extractInputDefaults(source);
  for (const [name, defaultValue] of Object.entries(inputDefaults)) {
    if (metadata.parameters![name]) {
      metadata.parameters![name].default = defaultValue;
    } else {
      metadata.parameters![name] = { default: defaultValue };
    }
  }

  const fileBasename = filePath
    .split('/')
    .pop()!
    .replace(PINE_EXTENSION, '');

  return {
    id: metadata.id ?? fileBasename,
    name: metadata.name ?? fileBasename,
    version: metadata.version ?? '1.0.0',
    description: metadata.description ?? '',
    author: metadata.author ?? 'MarketMind',
    tags: metadata.tags ?? [],
    status: metadata.status ?? 'active',
    enabled: metadata.enabled ?? true,
    parameters: metadata.parameters ?? {},
    filters: metadata.filters ?? {},
  };
};

export class PineStrategyLoader {
  private directories: string[];
  private cache: Map<string, PineStrategy> = new Map();
  private dirMtimeCache: Map<string, number> = new Map();

  constructor(directories: string[]) {
    this.directories = directories;
  }

  async loadAll(): Promise<PineStrategy[]> {
    const strategies: PineStrategy[] = [];

    for (const dir of this.directories) {
      const files = await this.findPineFiles(dir);
      for (const filePath of files) {
        const strategy = await this.loadFile(filePath);
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  async loadAllCached(): Promise<PineStrategy[]> {
    let needsReload = false;

    for (const dir of this.directories) {
      const dirStat = await stat(dir).catch(() => null);
      if (!dirStat) continue;

      const mtime = dirStat.mtimeMs;
      if (this.dirMtimeCache.get(dir) !== mtime) {
        this.dirMtimeCache.set(dir, mtime);
        needsReload = true;
      }
    }

    if (!needsReload && this.cache.size > 0) {
      return Array.from(this.cache.values());
    }

    const strategies = await this.loadAll();
    this.cache.clear();
    for (const s of strategies) {
      this.cache.set(s.metadata.id, s);
    }

    return strategies;
  }

  async loadFile(filePath: string): Promise<PineStrategy> {
    const source = await readFile(filePath, 'utf-8');
    const metadata = parseMetadata(source, filePath);

    return { metadata, source, filePath };
  }

  loadFromString(source: string, id?: string): PineStrategy {
    const metadata = parseMetadata(source, id ?? 'inline');

    return {
      metadata: { ...metadata, id: id ?? metadata.id },
      source,
      filePath: 'inline',
    };
  }

  getById(id: string): PineStrategy | undefined {
    return this.cache.get(id);
  }

  private async findPineFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(PINE_EXTENSION))
      .map((e) => join(directory, e.name))
      .sort();
  }
}
