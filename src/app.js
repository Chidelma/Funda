const App = {
    /**
     * 
     * @param {string[]} pageSegs
     * @param {string[]} pathSegs
     * @returns 
     */
    async pathsMatch(pageSegs, pathSegs) {

        if (pageSegs.length !== pathSegs.length) {
            return false;
        }

        const res = await fetch(`slugs.json`)

        if(!res.ok) throw new Error(`Failed to fetch slugs.json`, { cause: res.status })
        
        /** @type {Record<string, Record<string, number>>} */
        const pathSlugs = await res.json()

        /** @type {Record<string, number>} */
        const slugs = pathSlugs[`${pageSegs.join('/')}`] || {}
    
        for (let i = 0; i < pathSegs.length; i++) {
            if (slugs[routeSegs[i]] && pageSegs[i] !== pathSegs[i]) {
                return false;
            }
        }
    
        return true;
    },

    /**
     * 
     * @param {URL} url
     * @returns 
     */
    async renderPage(url) {

        let page;

        /** @type {string[]} */
        let params = []

        const paths = url.pathname.split('/')

        /** @type {Map<string, string>} */
        let slugs = new Map()

        let bestMatchKey = '';
        let bestMatchLength = -1;

        let res = await fetch(`indexes.json`)

        if (!res.ok) throw new Error(`Failed to fetch indexes.json`, { cause: res.status })

        /** @type {string[]} */
        const indexPages = await res.json()

        if(url.pathname === '/' && indexPages.includes('/')) {
            res = await fetch(`pages/index.html`)
            document.body.innerHTML = await res.text()
            document.slugs = slugs
            document.params = params
            return
        }

        for (const pageKey of indexPages) {

            const pageSegs = pageKey.split('/')
            
            const isMatch = App.pathsMatch(pageSegs, paths.slice(0, pageSegs.length));

            if (isMatch && pageSegs.length > bestMatchLength) {
                bestMatchKey = pageKey
                bestMatchLength = pageSegs.length
            }
        }

        if (bestMatchKey) {

            page = bestMatchKey

            params = paths.slice(bestMatchLength)

            const res = await fetch(`slugs.json`)

            if(!res.ok) throw new Error(`Failed to fetch slugs.json`, { cause: res.status })
            
            /** @type {Record<string, Record<string, number>>} */
            const pathSlugs = await res.json()

            const slugMap = pathSlugs[bestMatchKey] ?? {}

            for (const [key, idx] of Object.entries(slugMap)) {
                slugs.set(key, paths[idx])
            }
        }

        if (!page) throw new Error(`Page ${url.pathname} not found`, { cause: 404 })

        document.slugs = slugs
        document.params = params

        res = await fetch(`pages/${page}/index.html`)

        document.body.innerHTML = await res.text()
    }
}

await App.renderPage(new URL(window.location.href))

export default App