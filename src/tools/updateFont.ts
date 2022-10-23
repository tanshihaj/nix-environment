import * as webfont from 'webfont';
import * as path from 'path';
import * as fs from 'fs';

function getSvgIcons(dir: string) : string[] {
    return fs.readdirSync(dir).filter(e => e.endsWith('.svg')).map(e => path.join(dir, e));
}

async function generateFont(svgInput: string[], output: string) {
    try {
        const result = await webfont.webfont({
            files: svgInput,
            formats: ['woff'],
            startUnicode: 0xE000,
            verbose: true,
            normalize: true,
            sort: false
        });
        if (!result.woff) {
            throw new Error("webfont woff result is empty");
        }
        fs.writeFileSync(output, result.woff, 'binary');
    } catch (err) {
        console.error('Font creation failed.', err);
    }
}

const workdir = process.argv[2];
const files = getSvgIcons(workdir);
if (files.length === 0) {
    throw new Error(`cannot find any SVG icons in ${workdir}`);
}
generateFont(files, path.join(workdir, 'icons.woff'));