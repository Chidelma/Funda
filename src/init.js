#!/usr/bin/env bun
import { mkdir, rename } from 'node:fs/promises'

await Promise.allSettled([
    mkdir(`${process.cwd()}/src/pages`, { recursive: true }),
    mkdir(`${process.cwd()}/src/scripts`, { recursive: true }),
    mkdir(`${process.cwd()}/src/components`, { recursive: true }),
    mkdir(`${process.cwd()}/src/layouts`, { recursive: true }),
    mkdir(`${process.cwd()}/src/assets`, { recursive: true }),
    mkdir(`${process.cwd()}/src/styles`, { recursive: true }),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.js`, `${process.cwd()}/src/app.js`),
    rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.html`, `${process.cwd()}/src/app.html`),
])
