#!/usr/bin/env bun
import { mkdir, rename, rm, exists } from 'node:fs/promises'

const commad = process.argv[2]

switch(commad) {
    case 'init':
        await initialize()
        break;
    case 'page':
        if(process.argv[3] === "--add") await addPage(process.argv[4])
        else if(process.argv[3] === "--rm") await rmPage(process.argv[4])
        else console.error(`Invalid command: ${commad}`)
        break
    case 'layout':
        if(process.argv[3] === "--add") await addLayout(process.argv[4])
        else if(process.argv[3] === "--rm") await rmLayout(process.argv[4])
        else console.error(`Invalid command: ${commad}`)
        break;
    default:
        console.error(`Invalid command: ${commad}`)
}


async function initialize() {

    await Promise.allSettled([
        mkdir(`${process.cwd()}/src/pages`, { recursive: true }),
        mkdir(`${process.cwd()}/src/layouts`, { recursive: true })
    ])

    await Promise.allSettled([
        rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.html`, `${process.cwd()}/src/app.html`),
        Bun.write(`${process.cwd()}/src/pages/index.html`, '<h1>Hello World</h1>'),
        Bun.write(`${process.cwd()}/src/pages/index.js`, 'document.title = "Home" \n\nconst { slugs, params } = $ctx')
    ])

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/pages.json`, '[]'),
        Bun.write(`${process.cwd()}/src/slugs.json`, '{}'),
        Bun.write(`${process.cwd()}/src/layouts.json`, '[]')
    ])
}

async function addPage(path) {

    const [pages, pageSlugs] = await Promise.all([
        Bun.file(`${process.cwd()}/src/pages.json`).json(),
        Bun.file(`${process.cwd()}/src/slugs.json`).json(),
    ])

    const validateRoute = (route) => {  

        const paths = route.split('/')

        const pattern = /[<>|\[\]]/

        /** @type {Record<string, number>} */
        const slugs = {}

        if(pattern.test(paths[0]) || pattern.test(paths[paths.length - 1])) throw new Error(`Invalid route ${route}`)

        paths.forEach((path, idx) => {

            if(pattern.test(path) && (pattern.test(paths[idx - 1]) || pattern.test(paths[idx + 1]))) throw new Error(`Invalid route ${route}`)

            if(pattern.test(path)) slugs[path] = idx
        })

        pageSlugs[route] = slugs
    }

    validateRoute(path)

    const prefix = `${process.cwd()}/src/pages/${path}`

    if(await exists(`${prefix}/index.html`)) throw new Error(`Page ${path} already exists`)
    if(await exists(`${prefix}/index.js`)) throw new Error(`Page ${path} already exists`)

    await mkdir(prefix, { recursive: true })

    Bun.file(`${prefix}/index.html`).writer().end()
    Bun.file(`${prefix}/index.js`).writer().end()

    pages.push(path)

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/pages.json`, JSON.stringify(pages)),
        Bun.write(`${process.cwd()}/src/slugs.json`, JSON.stringify(pageSlugs))
    ])
}

async function rmPage(path) {

    const [pages, pageSlugs] = await Promise.all([
        Bun.file(`${process.cwd()}/src/pages.json`).json(),
        Bun.file(`${process.cwd()}/src/slugs.json`).json(),
    ])

    const prefix = `${process.cwd()}/src/pages/${path}`

    if(await exists(`${prefix}/index.html`)) await rm(`${prefix}/index.html`)
    if(await exists(`${prefix}/index.js`)) await rm(`${prefix}/index.js`)

    pages.splice(indexes.indexOf(path), 1)
    delete pageSlugs[path]

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/pages.json`, JSON.stringify(pages)),
        Bun.write(`${process.cwd()}/src/slugs.json`, JSON.stringify(pageSlugs))
    ])
}

async function addLayout(layout) {

    const file = Bun.file(`${process.cwd()}/src/layouts/${layout}.html`)

    if(await file.exists()) throw new Error(`Layout ${layout} already exists`)

    file.writer().end()

    /** @type {string[]} */
    const layouts = await Bun.file(`${process.cwd()}/src/layouts.json`).json()

    layouts.push(layout)

    await Bun.write(`${process.cwd()}/src/layouts.json`, JSON.stringify(layouts))
}

async function rmLayout(layout) {

    const path = `${process.cwd()}/src/layouts/${layout}.html`

    if(await exists(path)) await rm(path, { recursive: true })

    /** @type {string[]} */
    const layouts = await Bun.file(`${process.cwd()}/src/layouts.json`).json()

    layouts.splice(layouts.indexOf(layout), 1)

    await Bun.write(`${process.cwd()}/src/layouts.json`, JSON.stringify(layouts))
}