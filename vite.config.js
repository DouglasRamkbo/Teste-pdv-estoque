import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

function copyVendor() {
    return {
        name: 'copy-vendor',
        closeBundle() {
            copyDir(resolve(__dirname, 'vendor'), resolve(__dirname, 'dist/vendor'));
        }
    };
}

function copyDir(src, dest) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        const srcPath = `${src}/${entry}`;
        const destPath = `${dest}/${entry}`;
        if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
            output: { manualChunks: undefined }
        }
    },
    publicDir: false,
    assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf'],
    plugins: [copyVendor()]
});
