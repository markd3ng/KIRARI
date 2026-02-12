import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.resolve(__dirname, '../src/content/posts');

const CJK_TEXT = `
## CJK Rendering Test

### Chinese (Simplified)
这里是一段简体中文文本，用于测试字体渲染效果。
天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。

### Chinese (Traditional)
這裡是一段繁體中文文本，用於測試字體渲染效果。
天地玄黃，宇宙洪荒。日月盈昃，辰宿列張。

### Japanese
ここは日本語のテキストです。フォントのレンダリングをテストします。
いろはにほへと ちりぬるを わかよたれそ つねならむ

### Korean
여기는 한국어 텍스트입니다. 폰트 렌더링을 테스트합니다.
가나다라마바사 아자차카타파하

### Mixed
中文、日本語、한국어 mixed text line.
`;

function processDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDir(fullPath);
            continue;
        }

        if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
        if (file.includes('-cjk')) continue; // Avoid processing existing CJK files

        const content = fs.readFileSync(fullPath, 'utf-8');
        const ext = path.extname(file);
        const name = path.basename(file, ext);

        // Skip if already exists
        const newPath = path.join(dir, `${name}-cjk${ext}`);
        if (fs.existsSync(newPath)) {
            console.log(`Skipping ${newPath} (already exists)`);
            continue;
        }

        // Parse frontmatter (simple regex)
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            console.warn(`No frontmatter found in ${file}`);
            continue;
        }

        let frontmatter = frontmatterMatch[1];
        let body = content.substring(frontmatterMatch[0].length);

        // Update title and slug
        frontmatter = frontmatter.replace(/title:\s*(.*)/, (match, p1) => {
            // Remove quotes if present
            const title = p1.trim().replace(/^['"](.*)['"]$/, '$1');
            return `title: "${title} (CJK)"`;
        });

        // Update tags
        if (frontmatter.includes('tags:')) {
            frontmatter = frontmatter.replace(/tags:\s*\[(.*?)\]/, (match, p1) => {
                return `tags: [${p1 ? p1 + ', ' : ''}"CJK"]`;
            });
        } else {
            frontmatter += '\ntags: ["CJK"]';
        }

        // Assembly
        const newContent = `---\n${frontmatter}\n---\n${body}\n\n${CJK_TEXT}`;

        fs.writeFileSync(newPath, newContent, 'utf-8');
        console.log(`Generated ${newPath}`);
    }
}

console.log(`Scanning ${POSTS_DIR}...`);
processDir(POSTS_DIR);
console.log('Done.');
