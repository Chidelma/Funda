import { rename, mkdir } from 'node:fs/promises'

await Promise.allSettled([
    mkdir(`${process.cwd()}/pages`, { recursive: true }),
    mkdir(`${process.cwd()}/scripts`, { recursive: true }),
    mkdir(`${process.cwd()}/components`, { recursive: true }),
    mkdir(`${process.cwd()}/layouts`, { recursive: true }),
    mkdir(`${process.cwd()}/assets`, { recursive: true }),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.html`, `${process.cwd()}/app.html`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.js`, `${process.cwd()}/app.js`),
])
