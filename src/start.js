#!/usr/bin/env bun
import { watch } from 'node:fs'

try {

    const module = await import(`${process.cwd()}/node_modules/@vyckr/funda/src/app.js`)

    const App = module.default

    const start = Date.now()

    await validateRoutes()

    watch(`${process.cwd()}/src/pages`, { recursive: true }, async () => await validateRoutes())
    
    configLogger()

    const server = Bun.serve({
        fetch: async (req) => {
            await App.renderPage(new URL(req.url))
        },
        port: 3000
    })

    process.on('SIGINT', () => process.exit(0))

    console.info(`Server is running on http://${server.hostname}:${server.port} (Press CTRL+C to quit) - StartUp Time: ${Date.now() - start}ms`)

} catch (error) {
    console.error(error)
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
    console.info = (...args) => {
        const info = `[${Tach.formatDate()}]\x1b[32m INFO${reset} (${process.pid}) ${Tach.formatMsg(...args)}`
        log(info)
        if(Tach.context.getStore()) {
            const logWriter = Tach.context.getStore()
            if(logWriter && Tach.dbPath && Tach.saveLogs) logWriter.push({ date: Date.now(), msg: `${info.replace(reset, '').replace('\x1b[32m', '')}\n`, type: "info" })
        }
    }

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.error = (...args) => {
        const err = `[${Tach.formatDate()}]\x1b[31m ERROR${reset} (${process.pid}) ${Tach.formatMsg(...args)}`
        log(err)
        if(Tach.context.getStore()) {
            const logWriter = Tach.context.getStore()
            if(logWriter && Tach.dbPath && Tach.saveLogs) logWriter.push({ date: Date.now(), msg: `${err.replace(reset, '').replace('\x1b[31m', '')}\n`, type: "error" })
        }
    }

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.debug = (...args) => {
        const bug = `[${Tach.formatDate()}]\x1b[36m DEBUG${reset} (${process.pid}) ${Tach.formatMsg(...args)}`
        log(bug)
        if(Tach.context.getStore()) {
            const logWriter = Tach.context.getStore()
            if(logWriter && Tach.dbPath && Tach.saveLogs) logWriter.push({ date: Date.now(), msg: `${bug.replace(reset, '').replace('\x1b[36m', '')}\n`, type: "debug" })
        }
    }

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.warn = (...args) => {
        const warn = `[${Tach.formatDate()}]\x1b[33m WARN${reset} (${process.pid}) ${Tach.formatMsg(...args)}`
        log(warn)
        if(Tach.context.getStore()) {
            const logWriter = Tach.context.getStore()
            if(logWriter && Tach.dbPath && Tach.saveLogs) logWriter.push({ date: Date.now(), msg: `${warn.replace(reset, '').replace('\x1b[33m', '')}\n`, type: "warn" })
        }
    }

    /**
     * 
     * @param  {any[]} args 
     * @returns 
     */
    console.trace = (...args) => {
        const trace = `[${Tach.formatDate()}]\x1b[35m TRACE${reset} (${process.pid}) ${Tach.formatMsg(...args)}`
        log(trace)
        if(Tach.context.getStore()) {
            const logWriter = Tach.context.getStore()
            if(logWriter && Tach.dbPath && Tach.saveLogs) logWriter.push({ date: Date.now(), msg: `${trace.replace(reset, '').replace('\x1b[35m', '')}\n`, type: "trace" })
        }
    }
}