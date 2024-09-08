#!/usr/bin/env bun
import { watch } from 'node:fs'
import { Glob } from 'bun'

try {

    const module = await import(`${process.cwd()}/src/app.js`)

    const App = module.default

    const start = Date.now()

    await validateRoutes()

    watch(`${process.cwd()}/src/pages`, { recursive: true }, async () => await validateRoutes())
    
    configLogger()

    const server = Bun.serve({
        async fetch(req) {
            const url = new URL(req.url);
            return await handleRequest(url, App);
        },
        port: 3000, // or any other port
    });

    process.on('SIGINT', () => process.exit(0))

    console.info(`Server is running on http://${server.hostname}:${server.port} (Press CTRL+C to quit) - StartUp Time: ${Date.now() - start}ms`)

} catch (error) {
    console.error(error)
}

/**
 * Handle HTTP request and invoke renderPage.
 * @param {URL} url
 */
async function handleRequest(url, app) {
    try {
        // Trigger renderPage whenever a request is received
        await app.renderPage(url);

        // Return the updated HTML content after rendering
        return new Response(document.body.innerHTML, {
            headers: {
                'Content-Type': 'text/html',
            },
        });

    } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}


async function validateRoutes() {

    /** @type {Set<string>} */
    const indexes = new Set()

    /** @type {Record<string, Record<string, number>>} */
    const pageSlugs = {}

    /**
     * 
     * @param {string} route
     * @returns 
     */
    const validateRoute = (route) => {  

        const paths = route.split('/')

        const pattern = /[<>|\[\]]/

        /** @type {Record<string, number>} */
        const slugs = {}

        if(paths[paths.length - 1] !== 'index.html') throw new Error(`Invalid route ${route}`)

        paths.pop()

        if(paths.length === 0) {
            indexes.add('/')
            return
        }

        if(pattern.test(paths[0]) || pattern.test(paths[paths.length - 1])) throw new Error(`Invalid route ${route}`)

        paths.forEach((path, idx) => {

            if(pattern.test(path) && (pattern.test(paths[idx - 1]) || pattern.test(paths[idx + 1]))) throw new Error(`Invalid route ${route}`)

            if(pattern.test(path)) slugs[path] = idx
        })

        indexes.add(paths.join('/'))

        pageSlugs[route] = slugs
    }

    const files = Array.from(new Glob(`**/*.html`).scanSync({ cwd: `${process.cwd()}/src/pages` }))

    for(const route of files) validateRoute(route)

    await Promise.allSettled([Bun.write(`${process.cwd()}/src/indexes.json`, JSON.stringify(Array.from(indexes))), Bun.write(`${process.cwd()}/src/slugs.json`, JSON.stringify(pageSlugs))])
}


function configLogger() {

    const logger = console.log

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    function log(...args) {

        if (!args.length) {
            return;
        }

        const messages = args.map(arg => Bun.inspect(arg).replace(/\n/g, "\r"));

        logger(...messages);
    }

    const reset = '\x1b[0m'

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.info = (...args) => log(`[${formatDate()}]\x1b[32m INFO${reset} (${process.pid}) ${formatMsg(...args)}`)

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.error = (...args) => log(`[${formatDate()}]\x1b[31m ERROR${reset} (${process.pid}) ${formatMsg(...args)}`)

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.debug = (...args) => log(`[${formatDate()}]\x1b[36m DEBUG${reset} (${process.pid}) ${formatMsg(...args)}`)

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.warn = (...args) => log(`[${formatDate()}]\x1b[33m WARN${reset} (${process.pid}) ${formatMsg(...args)}`)

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.trace = (...args) => log(`[${formatDate()}]\x1b[35m TRACE${reset} (${process.pid}) ${formatMsg(...args)}`)
}

function formatDate() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

/**
 * 
 * @param  {any[]} msg 
 * @returns 
 */
function formatMsg(...msg) {

    if(msg instanceof Set) return "\n" + JSON.stringify(Array.from(msg), null, 2)
    
    else if(msg instanceof Map) return "\n" + JSON.stringify(Object.fromEntries(msg), null, 2)

    else if(msg instanceof FormData) {

        /** @type {Record<string, any>} */
        const formEntries = {}
        msg.forEach((val, key) => formEntries[key] = val)
        return "\n" + JSON.stringify(formEntries, null, 2)
    }

    else if(Array.isArray(msg) 
        || (typeof msg === 'object' && !Array.isArray(msg))
        || (typeof msg === 'object' && msg !== null)) return "\n" + JSON.stringify(msg, null, 2) 

    return msg
}