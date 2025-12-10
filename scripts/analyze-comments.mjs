#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const stats = {
    filesScanned: 0,
    commentBlocks: [],
};

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
};

function shouldPreserveComment(comment, line) {
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
        /TODO/,
        /FIXME/,
        /NOTE/,
        /HACK/,
        /XXX/,
        /BUG/,
        /OPTIMIZE/,
        /REFACTOR/,
        /TEMP/,
        /DEBUG/,
    ];
    
    if (preservePatterns.some(pattern => pattern.test(comment))) {
        return true;
    }
    
    if (comment.trim().startsWith('//') && line.trim() !== comment.trim()) {
        return true;
    }
    
    return false;
}

function analyzeComments(content, filePath) {
    const lines = content.split('\n');
    const comments = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const commentMatch = line.match(/^(\s*)\/\/(.*)$/);
        if (commentMatch) {
            const [, indent, comment] = commentMatch;
            const fullComment = `//${comment}`;
            
            if (!shouldPreserveComment(fullComment, line)) {
                comments.push({
                    line: i + 1,
                    type: 'inline',
                    content: line.trim(),
                    indent: indent.length,
                });
            }
        }
        
        if (line.trim().startsWith('/*') && !line.trim().startsWith('/**')) {
            if (line.includes('*/')) {
                if (!shouldPreserveComment(line, line)) {
                    comments.push({
                        line: i + 1,
                        type: 'block',
                        content: line.trim(),
                        multiline: false,
                    });
                }
            }
        }
    }
    
    if (comments.length > 0) {
        stats.commentBlocks.push({
            file: relative(process.cwd(), filePath),
            comments,
        });
    }
}

function walkDirectory(dir, filePattern, callback) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);

        if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === 'coverage' || entry === 'backups') {
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

function main() {
    console.log('🔍 MarketMind Comment Analysis Report');
    console.log('======================================\n');
    console.log('Analyzing comments that could be safely removed...\n');

    const filePattern = /\.(js|jsx|ts|tsx)$/;

    ['apps', 'packages'].forEach(dir => {
        walkDirectory(dir, filePattern, (filePath) => {
            stats.filesScanned++;
            
            if (stats.filesScanned % 50 === 0) {
                process.stdout.write(`\rScanned ${stats.filesScanned} files...`);
            }
            
            try {
                const content = readFileSync(filePath, 'utf-8');
                analyzeComments(content, filePath);
            } catch (error) {
                // Skip files that can't be read
            }
        });
    });

    console.log(`\rScanned ${stats.filesScanned} files...`);
    console.log('');
    log.success('Analysis complete!\n');

    console.log('📊 Summary:');
    console.log(`  Files scanned: ${stats.filesScanned}`);
    console.log(`  Files with removable comments: ${stats.commentBlocks.length}`);
    
    const totalComments = stats.commentBlocks.reduce((sum, block) => sum + block.comments.length, 0);
    console.log(`  Total removable comments: ${totalComments}\n`);

    if (stats.commentBlocks.length === 0) {
        log.success('No comments to remove! ✨');
        return;
    }

    console.log('📝 Detailed Report:\n');

    const report = [];
    report.push('# Comment Removal Report\n');
    report.push(`Generated: ${new Date().toISOString()}\n\n`);
    report.push(`## Summary\n`);
    report.push(`- Files scanned: ${stats.filesScanned}\n`);
    report.push(`- Files with removable comments: ${stats.commentBlocks.length}\n`);
    report.push(`- Total removable comments: ${totalComments}\n\n`);
    report.push(`## Files with Removable Comments\n\n`);

    stats.commentBlocks.forEach(block => {
        console.log(`📄 ${block.file} (${block.comments.length} comments)`);
        report.push(`### ${block.file}\n\n`);
        report.push(`${block.comments.length} removable comments found:\n\n`);
        
        block.comments.forEach(comment => {
            console.log(`   Line ${comment.line}: ${comment.content}`);
            report.push(`- Line ${comment.line} (${comment.type}): \`${comment.content}\`\n`);
        });
        
        console.log('');
        report.push('\n');
    });

    const reportPath = 'docs/COMMENT_REMOVAL_REPORT.md';
    writeFileSync(reportPath, report.join(''), 'utf-8');
    
    console.log('');
    log.success(`Report saved to ${reportPath}`);
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Review the report to verify which comments will be removed');
    console.log('  2. Run: pnpm refactor:remove-comments (to actually remove them)');
}

main();
