import { rename } from 'node:fs/promises'

await Promise.allSettled([
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/pages`, `${process.cwd()}/src/pages`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/scripts`, `${process.cwd()}/scripts`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/components`, `${process.cwd()}/components`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/layouts`, `${process.cwd()}/layouts`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/assets`, `${process.cwd()}/assets`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.html`, `${process.cwd()}/app.html`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.js`, `${process.cwd()}/app.js`),
])
