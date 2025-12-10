#!/usr/bin/env node

import { execSync } from 'child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = `backups/comments-removal-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const stats = {
    filesProcessed: 0,
    filesModified: 0,
    inlineCommentsRemoved: 0,
    blockCommentsRemoved: 0,
    linesRemoved: 0,
};

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warning: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    progress: (msg) => process.stdout.write(`\r${msg}`),
};

function shouldPreserveComment(comment) {
    const preservePatterns = [
        /^\/\*\*/,
        /@ts-ignore/,
        /@ts-expect-error/,
        /@ts-nocheck/,
        /eslint-disable/,
        /prettier-ignore/,
        /webpack/,
        /@param/,
        /@returns/,
        /@description/,
        /@example/,
        /SPDX-License/,
        /Copyright/,
        /MIT License/,
    ];

    return preservePatterns.some(pattern => pattern.test(comment));
}

function removeComments(content, filePath) {
    let modified = false;
    let inlineRemoved = 0;
    let blockRemoved = 0;
    let linesRemoved = 0;

    const lines = content.split('\n');
    const newLines = [];
    let inMultiLineComment = false;
    let multiLineComment = '';
    let multiLineStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const newLine = line;

        if (inMultiLineComment) {
            multiLineComment += `${line}\n`;

            if (line.includes('*/')) {
                inMultiLineComment = false;

                if (!shouldPreserveComment(multiLineComment)) {
                    blockRemoved++;
                    linesRemoved += (i - multiLineStartLine + 1);
                    modified = true;
                } else {
                    for (let j = multiLineStartLine; j <= i; j++) {
                        newLines.push(lines[j]);
                    }
                }

                multiLineComment = '';
                multiLineStartLine = 0;
            }
            continue;
        }

        if (line.trim().startsWith('/*') && !line.trim().startsWith('/**')) {
            inMultiLineComment = true;
            multiLineComment = `${line}\n`;
            multiLineStartLine = i;

            if (line.includes('*/')) {
                inMultiLineComment = false;

                if (!shouldPreserveComment(multiLineComment)) {
                    blockRemoved++;
                    linesRemoved++;
                    modified = true;
                    continue;
                }

                multiLineComment = '';
                multiLineStartLine = 0;
            } else {
                continue;
            }
        }

        const commentMatch = line.match(/^(\s*)\/\/(.*)$/);
        if (commentMatch) {
            const [, indent, comment] = commentMatch;
            const fullComment = `//${comment}`;

            if (!shouldPreserveComment(fullComment)) {
                inlineRemoved++;
                linesRemoved++;
                modified = true;
                continue;
            }
        }

        newLines.push(newLine);
    }

    if (modified) {
        stats.filesModified++;
        stats.inlineCommentsRemoved += inlineRemoved;
        stats.blockCommentsRemoved += blockRemoved;
        stats.linesRemoved += linesRemoved;
    }

    return { content: newLines.join('\n'), modified };
}

function processFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const { content: newContent, modified } = removeComments(content, filePath);

        if (modified) {
            writeFileSync(filePath, newContent, 'utf-8');
            return true;
        }

        return false;
    } catch (error) {
        log.error(`Failed to process ${filePath}: ${error.message}`);
        return false;
    }
}

function walkDirectory(dir, filePattern, callback) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);

        if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === 'coverage') {
            continue;
        }

        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            walkDirectory(fullPath, filePattern, callback);
        } else if (stat.isFile() && filePattern.test(entry)) {
            callback(fullPath);
        }
    }
}

function createBackup() {
    log.info('Creating backup...');
    mkdirSync(BACKUP_DIR, { recursive: true });

    cpSync('apps', join(BACKUP_DIR, 'apps'), { recursive: true });
    cpSync('packages', join(BACKUP_DIR, 'packages'), { recursive: true });

    log.success(`Backup created at ${BACKUP_DIR}`);
}

function restoreBackup() {
    log.warning('Restoring from backup...');

    execSync('rm -rf apps packages', { stdio: 'inherit' });
    cpSync(join(BACKUP_DIR, 'apps'), 'apps', { recursive: true });
    cpSync(join(BACKUP_DIR, 'packages'), 'packages', { recursive: true });

    log.success('Restored from backup');
}

function countTypeErrors() {
    try {
        const output = execSync('pnpm type-check 2>&1', { encoding: 'utf-8' });
        const matches = output.match(/error TS/g);
        return matches ? matches.length : 0;
    } catch (error) {
        const matches = error.stdout?.match(/error TS/g) || [];
        return matches.length;
    }
}

function runTypeCheck(baselineErrors) {
    log.info('Running type check...');

    const currentErrors = countTypeErrors();

    if (currentErrors === 0) {
        log.success('Type check passed! No errors found.');
        return true;
    }

    if (currentErrors === baselineErrors) {
        log.success(`Type check passed! Same number of errors as before (${currentErrors})`);
        return true;
    }

    if (currentErrors < baselineErrors) {
        log.success(`Type check improved! Errors reduced from ${baselineErrors} to ${currentErrors}`);
        return true;
    }

    log.error(`Type check failed! Errors increased from ${baselineErrors} to ${currentErrors}`);
    return false;
}

function runTests() {
    log.info('Running tests...');

    try {
        execSync('pnpm test', { stdio: 'inherit' });
        log.success('All tests passed!');
        return true;
    } catch (error) {
        log.error('Tests failed!');
        return false;
    }
}

function main() {
    console.log('🧹 MarketMind Comment Removal Script');
    console.log('=====================================\n');
    console.log('This script safely removes comments while preserving:');
    console.log('  ✅ JSDoc comments (/** ... */)');
    console.log('  ✅ License headers');
    console.log('  ✅ Type definition documentation');
    console.log('  ✅ @ts-ignore, @ts-expect-error directives');
    console.log('  ✅ eslint-disable comments\n');

    log.info('Checking baseline type errors...');
    const baselineErrors = countTypeErrors();
    log.info(`Found ${baselineErrors} existing type errors\n`);

    createBackup();

    console.log('');
    log.info('Processing TypeScript files...\n');

    const filePattern = /\.(ts|tsx)$/;

    ['apps', 'packages'].forEach(dir => {
        walkDirectory(dir, filePattern, (filePath) => {
            stats.filesProcessed++;

            if (stats.filesProcessed % 10 === 0) {
                log.progress(`  Processed ${stats.filesProcessed} files...`);
            }

            processFile(filePath);
        });
    });

    console.log('\n');
    log.success('Processing complete!\n');

    console.log('📊 Summary:');
    console.log(`  Files processed: ${stats.filesProcessed}`);
    console.log(`  Files modified: ${stats.filesModified}`);
    console.log(`  Inline comments removed: ${stats.inlineCommentsRemoved}`);
    console.log(`  Block comments removed: ${stats.blockCommentsRemoved}`);
    console.log(`  Lines removed: ${stats.linesRemoved}\n`);

    if (stats.filesModified === 0) {
        log.info('No comments to remove. Exiting...');
        return;
    }

    if (!runTypeCheck(baselineErrors)) {
        restoreBackup();
        process.exit(1);
    }

    console.log('');

    if (!runTests()) {
        restoreBackup();
        process.exit(1);
    }

    console.log('');
    log.success('Comment removal completed successfully!\n');

    console.log('📝 Next steps:');
    console.log('  1. Review changes: git diff');
    console.log('  2. Check specific files for correctness');
    console.log('  3. Commit changes: git add . && git commit -m "chore: remove inline and block comments"\n');
    console.log(`💾 Backup location: ${BACKUP_DIR}`);
}

main();
