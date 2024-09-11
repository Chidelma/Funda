#!/usr/bin/env bun
import { mkdir, rename, rm, exists } from 'node:fs/promises'

const commad = process.argv[2]

switch(commad) {
    case 'init':
        await initialize()
        break;
    case 'route':
        if(process.argv[3] === "--add") await addRoute(process.argv[4])
        else if(process.argv[3] === "--rm") await rmRoute(process.argv[4])
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
        mkdir(`${process.cwd()}/src/routes`, { recursive: true }),
        mkdir(`${process.cwd()}/src/layouts`, { recursive: true })
    ])

    await Promise.allSettled([
        rename(`${process.cwd()}/node_modules/@vyckr/funda/src/app.html`, `${process.cwd()}/src/app.html`),
        Bun.write(`${process.cwd()}/src/routes/index.html`, '<h1>Hello World</h1>'),
        Bun.write(`${process.cwd()}/src/routes/index.js`, 'document.title = "Home" \n\nconst { slugs, params } = $ctx')
    ])

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/routes.json`, '[]'),
        Bun.write(`${process.cwd()}/src/slugs.json`, '{}'),
        Bun.write(`${process.cwd()}/src/layouts.json`, '[]')
    ])
}

/**
 * 
 * @param {string} route
 */
async function addRoute(route) {

    const [routes, routeSlugs] = await Promise.all([
        Bun.file(`${process.cwd()}/src/routes.json`).json(),
        Bun.file(`${process.cwd()}/src/slugs.json`).json(),
    ])

    /**
     * 
     * @param {string} route 
     */
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

        routeSlugs[route] = slugs
    }

    validateRoute(route)

    const prefix = `${process.cwd()}/src/routes/${route}`

    if(await exists(`${prefix}/index.html`)) throw new Error(`Route ${route} already exists`)
    if(await exists(`${prefix}/index.js`)) throw new Error(`Route ${route} already exists`)

    await mkdir(prefix, { recursive: true })

    Bun.file(`${prefix}/index.html`).writer().end()
    Bun.file(`${prefix}/index.js`).writer().end()

    routes.push(route)

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/routes.json`, JSON.stringify(routes)),
        Bun.write(`${process.cwd()}/src/slugs.json`, JSON.stringify(routeSlugs))
    ])
}

/**
 * 
 * @param {string} route 
 */
async function rmRoute(route) {

    const [routes, routeSlugs] = await Promise.all([
        Bun.file(`${process.cwd()}/src/routes.json`).json(),
        Bun.file(`${process.cwd()}/src/slugs.json`).json(),
    ])

    const prefix = `${process.cwd()}/src/routes/${route}`

    if(await exists(`${prefix}/index.html`)) await rm(`${prefix}/index.html`)
    if(await exists(`${prefix}/index.js`)) await rm(`${prefix}/index.js`)

    routes.splice(indexes.indexOf(route), 1)
    delete routeSlugs[route]

    await Promise.allSettled([
        Bun.write(`${process.cwd()}/src/routes.json`, JSON.stringify(routes)),
        Bun.write(`${process.cwd()}/src/slugs.json`, JSON.stringify(routeSlugs))
    ])
}

/**
 * 
 * @param {string} layout 
 */
async function addLayout(layout) {

    const file = Bun.file(`${process.cwd()}/src/layouts/${layout}.html`)

    if(await file.exists()) throw new Error(`Layout ${layout} already exists`)

    file.writer().end()

    /** @type {string[]} */
    const layouts = await Bun.file(`${process.cwd()}/src/layouts.json`).json()

    layouts.push(layout)

    await Bun.write(`${process.cwd()}/src/layouts.json`, JSON.stringify(layouts))
}

/**
 * 
 * @param {string} layout 
 */
async function rmLayout(layout) {

    const path = `${process.cwd()}/src/layouts/${layout}.html`

    if(await exists(path)) await rm(path, { recursive: true })

    /** @type {string[]} */
    const layouts = await Bun.file(`${process.cwd()}/src/layouts.json`).json()

    layouts.splice(layouts.indexOf(layout), 1)

    await Bun.write(`${process.cwd()}/src/layouts.json`, JSON.stringify(layouts))
}