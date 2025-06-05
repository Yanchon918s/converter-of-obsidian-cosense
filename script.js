const inputArea = document.getElementById('inputArea');
const outputArea = document.getElementById('outputArea');
const conversionDirectionSelect = document.getElementById('conversionDirection');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');

/**
 * Converts Obsidian-flavored Markdown to Consense/Scrapbox-like syntax.
 */
function obsidianToConsense(obsidianText) {
    let lines = obsidianText.split('\n');
    let consenseLines = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let inYamlFrontmatter = false;
    let yamlLines = [];
    let inDataviewBlock = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // YAML Frontmatter
        if (line.trim() === '---') {
            if (!inYamlFrontmatter && i === 0 && !inCodeBlock && !inDataviewBlock) {
                inYamlFrontmatter = true; yamlLines = []; continue;
            } else if (inYamlFrontmatter) {
                inYamlFrontmatter = false;
                yamlLines.forEach(yamlLine => {
                    const parts = yamlLine.split(':');
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();
                    if (key && value) consenseLines.push(`${key}: ${value}`);
                    else if (key) consenseLines.push(key);
                });
                if (yamlLines.length > 0) consenseLines.push('----');
                continue;
            }
        }
        if (inYamlFrontmatter) { yamlLines.push(line); continue; }

        // Code Blocks
        if (line.trim().startsWith('```') && !line.trim().toLowerCase().startsWith('```dataview')) {
            if (!inCodeBlock) {
                inCodeBlock = true; codeBlockLang = line.trim().substring(3).trim();
                consenseLines.push(`code:${codeBlockLang || 'text'}`);
            } else { inCodeBlock = false; }
            continue;
        }
        if (inCodeBlock) { consenseLines.push(' ' + line); continue; }

        // Dataview Blocks
        if (line.trim().toLowerCase().startsWith('```dataview')) {
            if (!inDataviewBlock) {
                inDataviewBlock = true; consenseLines.push('dataview:');
            } else { inDataviewBlock = false; }
            continue;
        }
        if (inDataviewBlock) {
            if (line.trim() === '```') { inDataviewBlock = false; continue; }
            consenseLines.push(' ' + line); continue;
        }

        // Obsidian Tags と Links は保持（変換しない）
        // #tag → #tag (そのまま)
        // [[link]] → [[link]] (そのまま)
        // ただし、見出し記法との競合を避けるため、行頭の#を見出しとして処理した後に実行


        // Headings (H1 should not conflict with #tag rule if tag rule runs first and converts #tag)
        let headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
            let level = headingMatch[1].length;
            let text = headingMatch[2].trim();
            let stars = (level === 1) ? '****' : (level === 2) ? '***' : (level === 3) ? '**' : '*';
            consenseLines.push('[' + stars + ' ' + text + ']');
            continue;
        }

        // Horizontal Rule
        if (line.match(/^(\-{3,}|\*{3,}|_{3,})$/)) { consenseLines.push('----'); continue; }

        // Checklists & Lists
        let checklistMatch = line.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([x\s])\]\s+(.*)/);
        if (checklistMatch) {
            let indent = ' '.repeat(Math.floor(checklistMatch[1].length / 2) + 1);
            consenseLines.push(indent + '[' + checklistMatch[2] + '] ' + checklistMatch[3]);
            continue;
        }
        let listItemMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (listItemMatch) {
            let indent = ' '.repeat(Math.floor(listItemMatch[1].length / 2) + 1);
            let itemText = listItemMatch[2].match(/^\d+\.$/) ? listItemMatch[2] + ' ' + listItemMatch[3] : listItemMatch[3];
            consenseLines.push(indent + itemText);
            continue;
        }

        // Blockquotes
        if (line.startsWith('>')) {
            let currentLine = line; let quoteLevel = 0;
            while (currentLine.startsWith('>')) { currentLine = currentLine.substring(1).trimStart(); quoteLevel++; }
            let calloutMatch = currentLine.match(/^\[(!\w+)\]\s*(.*)/);
            consenseLines.push(' '.repeat(quoteLevel) + (calloutMatch ? `[${calloutMatch[1]}] ${calloutMatch[2]}` : currentLine));
            continue;
        }

        // Tables
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            if (consenseLines.length === 0 || (!consenseLines[consenseLines.length - 1].startsWith('table:') && !(consenseLines[consenseLines.length - 1].startsWith(' ') && consenseLines[consenseLines.length - 1].trim().includes('|')))) {
                consenseLines.push('table:');
            }
            consenseLines.push(' ' + line.trim().slice(1, -1).split('|').map(s => s.trim()).join(' | '));
            continue;
        }
        consenseLines.push(line);
    }

    let consenseText = consenseLines.join('\n');

    // Inline styles - ブラウザ互換性を考慮した処理
    // 太字を先に処理してからイタリックを処理
    
    // 1. 打ち消し線付きのパターンを最初に処理
    consenseText = consenseText.replace(/~~(?:\*{3}|_{3})(.*?)(?:\*{3}|_{3})~~/g, '[-/*** $1]');
    consenseText = consenseText.replace(/~~(?:\*{2}|_{2})(.*?)(?:\*{2}|_{2})~~/g, '[-* $1]');
    consenseText = consenseText.replace(/~~(?:\*|_)(.*?)(?:\*|_)~~/g, '[-/* $1]');
    
    // 2. 太字と斜体の組み合わせ
    consenseText = consenseText.replace(/(?:\*{3}|_{3})(.*?)(?:\*{3}|_{3})/g, '[/*** $1]');
    
    // 3. 太字（** または __）
    consenseText = consenseText.replace(/\*\*([^*\n]+?)\*\*/g, '[* $1]');
    consenseText = consenseText.replace(/__([^_\n]+?)__/g, '[* $1]');
    
    // 4. 斜体（* または _）- 太字処理後にマーカーを置いて処理
    // まず太字変換済みマーカーを設置
    consenseText = consenseText.replace(/\[\*\s([^\]]+?)\]/g, '###BOLD###$1###/BOLD###');
    
    // 斜体変換
    consenseText = consenseText.replace(/\*([^*\n]+?)\*/g, '[/ $1]');
    consenseText = consenseText.replace(/_([^_\n]+?)_/g, '[/ $1]');
    
    // 太字マーカーを復元
    consenseText = consenseText.replace(/###BOLD###([^#]+?)###\/BOLD###/g, '[* $1]');
    
    // 5. 打ち消し線
    consenseText = consenseText.replace(/~~(.*?)~~/g, '[- $1]');

    // Obsidian Links は保持（変換しない）
    // [[link]] → [[link]] (そのまま)
    
    // Images & External Links（インライン変換の後に処理）
    consenseText = consenseText.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => `[${url.trim()}${alt.trim() ? ' ' + alt.trim() : ''}]`);
    consenseText = consenseText.replace(/(?:^|[^!])\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        const prefix = match.startsWith('!') ? '' : match[0]; // Preserve prefix if not '!'
        return `${prefix}[${url.trim()}${text.trim() ? ' ' + text.trim() : ''}]`;
    });

    consenseText = consenseText.replace(/\s\^[\w-]+/g, '');
    consenseText = consenseText.replace(/#\^([\w-]+)/g, '#$1');

    return consenseText;
}

/**
 * Converts Consense/Scrapbox-like syntax to Obsidian-flavored Markdown.
 */
function consenseToObsidian(consenseText) {
    let lines = consenseText.split('\n');
    let obsidianLines = [];
    let inCodeBlock = false; 
    let codeBlockLang = ''; 
    let inTableBlock = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Code Blocks & Tables
        if (line.toLowerCase().startsWith('code:') || line.toLowerCase().startsWith('dataview:')) {
            if (inCodeBlock) obsidianLines.push('```');
            inCodeBlock = true; 
            let parts = line.split(':');
            codeBlockLang = parts[0].toLowerCase() === 'dataview' ? 'dataview' : (parts.slice(1).join(':').trim() || 'text');
            obsidianLines.push('```' + codeBlockLang); 
            continue;
        }
        if (inCodeBlock) {
            if (!line.startsWith(' ') && line.trim() !== "") { 
                obsidianLines.push('```'); 
                inCodeBlock = false; 
                i--; 
                continue; 
            }
            if (line.trim() === "" && (i + 1 >= lines.length || !lines[i + 1].startsWith(" "))) {
                obsidianLines.push(line.substring(1)); 
                obsidianLines.push('```'); 
                inCodeBlock = false; 
                continue;
            }
            obsidianLines.push(line.substring(1)); 
            continue;
        }
        if (line.toLowerCase().startsWith('table:')) {
            inTableBlock = true;
            if (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
                let headerLine = lines[i + 1].substring(1).trim();
                if (headerLine.includes('|')) {
                    obsidianLines.push(`| ${headerLine.split('|').map(s => s.trim()).join(' | ')} |`);
                    obsidianLines.push(`| ${Array(headerLine.split('|').length).fill('---').join(' | ')} |`);
                    i++;
                } else { 
                    inTableBlock = false; 
                    obsidianLines.push(line); 
                }
            } else { 
                inTableBlock = false; 
                obsidianLines.push(line); 
            }
            continue;
        }
        if (inTableBlock) {
            if (!line.startsWith(' ') && line.trim() !== "") { 
                inTableBlock = false; 
                i--; 
                continue; 
            }
            if (line.trim() === "" && (i + 1 >= lines.length || !lines[i + 1].startsWith(" "))) { 
                inTableBlock = false; 
                i--; 
                continue; 
            }
            let tableRow = line.substring(1).trim();
            if (!tableRow.match(/^[-:| ]+$/) && tableRow.includes('|')) {
                obsidianLines.push(`| ${tableRow.split('|').map(s => s.trim()).join(' | ')} |`);
            } else if (tableRow.trim() !== "") { 
                inTableBlock = false; 
                i--; 
            }
            continue;
        }

        // Consense Headings (full line match)
        let headingMatch = line.match(/^\[(\*{1,6})\s+(.*?)\]$/);
        if (headingMatch && line.trim() === headingMatch[0]) {
            let sc = headingMatch[1].length;
            let text = headingMatch[2].trim(); // Trim text from inside brackets
            if (sc === 4) { // [**** content] → # content (H1)
                obsidianLines.push('# ' + text);
            } else if (sc === 3) { // [*** content] → ## content (H2)
                obsidianLines.push('## ' + text); 
            } else if (sc === 2) { // [** content] → ### content (H3)
                obsidianLines.push('### ' + text); 
            } else { // [* content] → #### content (H4)
                obsidianLines.push('#### ' + text); 
            }
            continue;
        }

        // Horizontal Rule
        if (line.trim() === '----') { 
            obsidianLines.push('---'); 
            continue; 
        }

        // Checklists & Lists
        let consenseChecklistMatch = line.match(/^(\s*)\[([x\s])\]\s+(.*)/);
        if (consenseChecklistMatch) {
            let indent = '  '.repeat(Math.max(0, consenseChecklistMatch[1].length - 1));
            obsidianLines.push(indent + '- [' + consenseChecklistMatch[2] + '] ' + consenseChecklistMatch[3]); 
            continue;
        }
        let indentedLineMatch = line.match(/^(\s+)(.*)/);
        if (indentedLineMatch && !consenseChecklistMatch) {
            let indent = '  '.repeat(Math.max(0, indentedLineMatch[1].length - 1));
            let content = indentedLineMatch[2];
            obsidianLines.push(indent + (content.match(/^(\d+\.)\s+(.*)/) ? content : (content.trim() !== "" ? '- ' + content : line))); 
            continue;
        }
        obsidianLines.push(line);
    }
    if (inCodeBlock) obsidianLines.push('```');

    let obsidianText = obsidianLines.join('\n');

    // Tags と Links は保持（変換しない）
    // #tag → #tag (そのまま)
    // [[link]] → [[link]] (そのまま)

    // Inline styles - より精密な処理（順序を調整）
    // [* text] → **text** に変更
    obsidianText = obsidianText.replace(/\[-\/\*\*\*\s+(.*?)\s*\]/g, '~~***$1***~~');
    obsidianText = obsidianText.replace(/\[-\*\s+(.*?)\s*\]/g, '~~**$1**~~');
    obsidianText = obsidianText.replace(/\[-\/\*\s+(.*?)\s*\]/g, '~~*$1*~~');
    obsidianText = obsidianText.replace(/\[\/\*\*\*\s+(.*?)\s*\]/g, '***$1***');
    obsidianText = obsidianText.replace(/\[\*\s+(.*?)\s*\]/g, '**$1**');
    obsidianText = obsidianText.replace(/\[\/\s+(.*?)\s*\]/g, '*$1*');
    obsidianText = obsidianText.replace(/\[-\s+(.*?)\s*\]/g, '~~$1~~');

    // Images & External Links の基本的な処理のみ保持（インライン変換の後に処理）
    obsidianText = obsidianText.replace(/\[([^\]]+?)\]/g, (match, content) => {
        content = content.trim();
        const parts = content.split(/\s+/);
        const firstPart = parts[0];
        
        const isUrl = (s) => /^https?:\/\//.test(s) || s.startsWith('www.');
        const isImg = (s) => /\.(jpeg|jpg|gif|png|svg|webp|bmp)$/i.test(s);
        
        // Image handling
        if (isImg(firstPart)) {
            const alt = parts.slice(1).join(' ').trim();
            return `![${alt}](${firstPart})`;
        }
        if (parts.length > 1 && isImg(parts[parts.length - 1])) {
            const alt = parts.slice(0, -1).join(' ').trim();
            const url = parts[parts.length - 1];
            return `![${alt}](${url})`;
        }
        
        // URL link handling
        if (isUrl(firstPart)) {
            const linkText = parts.slice(1).join(' ').trim() || firstPart;
            return `[${linkText}](${firstPart})`;
        }
        if (parts.length > 1 && isUrl(parts[parts.length - 1])) {
            const linkText = parts.slice(0, -1).join(' ').trim();
            const url = parts[parts.length - 1];
            return `[${linkText}](${url})`;
        }
        
        // その他のブラケットはそのまま保持
        return match;
    });
    
    return obsidianText;
}

function performConversion() {
    const direction = conversionDirectionSelect.value;
    const inputText = inputArea.value;
    try {
        outputArea.value = (direction === 'o2c') ? obsidianToConsense(inputText) : consenseToObsidian(inputText);
    } catch (e) {
        outputArea.value = "変換中にエラーが発生しました:\n" + e.message + "\n" + e.stack;
        console.error("Conversion Error:", e);
    }
}

inputArea.addEventListener('input', performConversion);
conversionDirectionSelect.addEventListener('change', performConversion);
swapBtn.addEventListener('click', () => { inputArea.value = outputArea.value; performConversion(); });
clearBtn.addEventListener('click', () => { inputArea.value = ''; outputArea.value = ''; });
if (inputArea.value) performConversion();
