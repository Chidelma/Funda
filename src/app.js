const App = {
    initBody: '',
    count: 0,
    isRendering: false,

    layouts: new Map(),
    routes: new Map(),

    routesDir: 'routes',
    layoutsDir: 'layouts',
    elementsVar: 'elements',
    slugsKey: '_slugs',
    indexKey: 'index',
    jsExt: 'js',
    jsonExt: 'json',
    htmlExt: 'html',

    /**
     * Fetch JSON data and return the parsed result.
     * @param {string} url
     * @returns {Promise<any>}
     */
    async fetchJSON(url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch ${url}`, { cause: res.status })
        return await res.json()
    },

    /**
     * Check if the page segments match the path segments.
     * @param {string[]} routeSegs
     * @param {string[]} pathSegs
     * @returns {boolean}
     */
    pathsMatch(routeSegs, pathSegs) {

        if (routeSegs.length !== pathSegs.length) return false;

        const pathSlugs = JSON.parse(sessionStorage.getItem(this.slugsKey))
        
        const slugs = pathSlugs[`${routeSegs.join('/')}`] || {};

        for (let i = 0; i < pathSegs.length; i++) {
            if (slugs[pathSegs[i]] && routeSegs[i] !== pathSegs[i]) {
                return false;
            }
        }

        return true;
    },

    async initializeAssets() {

        if(this.routes.size === 0) {
            const routes = await this.fetchJSON(`${this.routesDir}.${this.jsonExt}`);
            for(const route of routes) {
                const res = await fetch(`${this.routesDir}/${route}/${this.indexKey}.${this.htmlExt}`);
                this.routes.set(page, await res.text());
            }
        } 

        if(this.layouts.size === 0) {
            const layouts = await this.fetchJSON(`${this.layoutsDir}.${this.jsonExt}`);
            for(const layout of layouts) {
                const res = await fetch(`${this.layoutsDir}/${layout}.${this.htmlExt}`);
                this.layouts.set(layout, await res.text());
            }
        }

        // Load slugs
        if(sessionStorage.getItem(this.slugsKey) === null) {
            sessionStorage.setItem(this.slugsKey, JSON.stringify(await this.fetchJSON(`slugs.${this.jsonExt}`)));
        }

        if(!this.routes.has('/')) {
            const res = await fetch(`${this.routesDir}/${this.indexKey}.${this.htmlExt}`);
            this.routes.set('/', await res.text());
        }

        App.initBody = this.routes.get('/');

        globalThis.exports = await import(`${this.routesDir}/${this.indexKey}.${this.jsExt}`);

        if (!App.isRendering) {
            App.isRendering = true;
            this.renderDOM();
            App.isRendering = false;
        }

        App.count = 0;

        this.indexEvents(document.body.children);
    },

    /**
     * Render the page based on the given URL.
     * @param {URL} url
     */
    async renderPage(url) {

        let route
        let params = []
        const paths = url.pathname.split('/')
        let slugs = {}
        let bestMatchRoute = ''
        let routeLength = -1

        // If root page
        if (url.pathname === '/') {
            globalThis.$ctx = { params: [], slugs: {} }
            globalThis.$route = '/'
            await this.initializeAssets()
            globalThis.history.replaceState(location.origin, '', '/')
            return
        }

        for (const route of this.routes.keys()) {

            if(route === '/') continue

            const routeSegs = route.split('/')

            const isMatch = this.pathsMatch(routeSegs, paths.slice(0, routeSegs.length))

            if (isMatch && routeSegs.length > routeLength) {
                bestMatchRoute = route;
                routeLength = routeSegs.length
            }
        }

        if (bestMatchRoute) {

            route = bestMatchRoute
            params = paths.slice(routeLength)

            const pathSlugs = JSON.parse(sessionStorage.getItem(this.slugsKey))
            const slugMap = pathSlugs[bestMatchRoute] || {};

            for (const [key, idx] of Object.entries(slugMap)) {
                slugs[key] = paths[idx]
            }

            globalThis.$ctx = { params, slugs }
            globalThis.$route = route 

            sessionStorage.setItem(this.slugsKey, JSON.stringify(pathSlugs));
        }

        if(!route) throw new Error(`Page ${url.pathname} not found`, { cause: 404 })

        await this.loadPage(route)

        globalThis.history.pushState(location.href, '', url.pathname);
    },

    /**
     * Load and render a page's HTML and JS.
     * @param {string} route
     */
    async loadPage(route) {

        App.initBody = this.routes.get(route)

        globalThis.exports = await import(`${this.routesDir}/${route}/${this.indexKey}.${this.jsExt}`);

        if (!App.isRendering) {
            App.isRendering = true;
            this.renderDOM();
            App.isRendering = false;
        }

        App.count = 0;
        this.indexEvents(document.body.children);
    },

    /**
     * Parse the HTML elements and generate a lambda function for rendering.
     * @param {HTMLCollection} elements
     */
    parseHTML(elements) {

        const parsed = [];

        for (const element of elements) {

            if (element.tagName === 'TEMPLATE') {

                const attribute = element.attributes[0];

                if (!attribute) continue;

                if (attribute.name === ':for') parsed.push(`for(${attribute.value}) {`);
                if (attribute.name === ':if') parsed.push(`if(${attribute.value}) {`);

                if (attribute.name === 'layout') {
                    const layoutHTML = this.layouts.get(attribute.value);
                    const tempLayout = document.createElement('div');
                    tempLayout.innerHTML = layoutHTML;

                    this.replaceSlot(tempLayout, element.innerHTML);
                    parsed.push(...this.parseHTML(tempLayout.children));
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = element.innerHTML;
                    parsed.push(...this.parseHTML(temp.children));
                }

                if (attribute.name === ':for' || attribute.name === ':if') parsed.push('}');

            } else parsed.push(`${this.elementsVar} += \`${element.outerHTML}\``)
        }

        return parsed;
    },

    /**
     * 
     * @param {HTMLElement} layoutElement 
     * @param {string} templateContent 
     */
    replaceSlot(layoutElement, templateContent) {

        const slot = layoutElement.querySelector('slot')
        
        if (slot) slot.outerHTML = templateContent; // Replace slot with the template content
    },

    /**
     * Recursively assign events to elements.
     * @param {HTMLCollection} elements
     * @param {string | undefined} focusId
     * @param {number | undefined} cursorPos
     */
    indexEvents(elements, focusId, cursorPos) {

        for (const element of elements) {
            
            element.id = element.id.length === 0 ? ++App.count : element.id;

            for (const attribute of element.attributes) {

                if (attribute.name.startsWith('@')) {
                
                    const eventName = attribute.name.slice(1);

                    element.addEventListener(eventName, (e) => {

                        if (['input', 'change', 'submit'].includes(eventName)) {

                            globalThis[attribute.value](e.target.value);

                            if (!App.isRendering) {
                                App.isRendering = true;
                                App.renderDOM()
                                App.isRendering = false;
                            }

                            App.indexEvents(document.body.children, element.id, e.target.selectionStart);

                        } else {

                            eval(attribute.value);

                            if (!App.isRendering) {
                                App.isRendering = true;
                                App.renderDOM()
                                App.isRendering = false;
                            }

                            App.indexEvents(document.body.children);
                        }
                    });
                }

                if(attribute.name.includes('href')) {

                    element.addEventListener('click', async (e) => {
                        if(!attribute.value.startsWith('http')) {
                            e.preventDefault()
                            await App.renderPage(new URL(`${location.origin}${attribute.value}`))
                        }
                    })
                }
            }

            App.indexEvents(element.children);
        }

         // Re-focus the element after DOM changes
        if (focusId) {

            const element = document.getElementById(focusId);

            if (element) {

                element.focus();

                // Check if setSelectionRange is available and only use it on input-like elements
                if (cursorPos !== null && 'setSelectionRange' in element) {
                    element.setSelectionRange(cursorPos, cursorPos);
                }
            }
        }
    },

    /**
     * Render the DOM by parsing HTML and invoking a lambda function.
     */
    renderDOM() {

        App.count = 0
    
        const renderHTML = () => {

            document.body.innerHTML = App.initBody
    
            const parsed = App.parseHTML(document.body.children)
            const lambda = App.getLambda(parsed)
            document.body.innerHTML = lambda()
        }
    
        /**
         * 
         * @param {string} globalKey
         * @param {any} value 
         * @param {Storage} storageType 
         * @param {string} storeKey 
         */
        const handleStoreUpdate = (globalKey, value, storageType, storeKey) => {

            if (typeof value === 'object')storageType.setItem(storeKey, JSON.stringify(value))
            else storageType.setItem(storeKey, value)
    
            globalThis[globalKey] = value
        }
        
        /**
         * 
         * @param {string} globalKey
         * @param {Storage} storageType 
         * @param {string} storeKey 
         */
        const restoreValueFromStorage = (globalKey, storageType, storeKey) => {

            const storedValue = storageType.getItem(storeKey)
    
            if (storedValue) {
                try {
                    globalThis[globalKey] = JSON.parse(storedValue)
                } catch {
                    globalThis[globalKey] = storedValue
                }
            }
        }
    
        /**
         * 
         * @param {string} globalKey 
         * @param {any} store 
         */
        const subscribeToStore = (globalKey, store) => {

            const storeKey = `${globalThis.$route}/${globalKey}`
            const storageType = globalThis[`${key.startsWith('$') ? 'session' : 'local'}Storage`]
    
            store.subscribe(val => {

                handleStoreUpdate(globalKey, val, storageType, storeKey)
    
                if (!App.isRendering) {
                    App.isRendering = true
                    renderHTML()
                    App.isRendering = false
                }
    
                App.indexEvents(document.body.children)
            })
    
            restoreValueFromStorage(globalKey, storageType, storeKey)
            globalThis[globalKey] = store.get()
        }
        
        /**
         * 
         * @param {string} globalKey 
         * @param {any} value 
         */
        const processGlobalValue = (globalKey, value) => {

            if (globalKey.startsWith('$') || globalKey.startsWith('&')) {

                const storeKey = `${globalThis.$route}/${globalKey}`

                const storageType = globalThis[`${globalKey.startsWith('$') ? 'session' : 'local'}Storage`]
    
                restoreValueFromStorage(globalKey, storageType, storeKey)

            } else globalThis[globalKey] = value
        }
    
        for (const key in globalThis.exports) {

            const value = globalThis.exports[key]
    
            if (value && value.subscribe) subscribeToStore(key, value)
            else processGlobalValue(key, value)
        }
    
        renderHTML()
    },

    /**
     * Utility to get the lambda function for rendering HTML.
     * @param {string[]} parsedHTML
     * @returns {Function}
     */
    getLambda(parsedHTML) {
        const script = `
            return function () {
                let ${this.elementsVar} = '';
                ${parsedHTML.join('\n')}
                return ${this.elementsVar};
            }
        `;
        return new Function(script)()
    }
}

/**
 * 
 * @param {any} initialValue 
 */
globalThis.$state = (initialValue) => {

    let value = initialValue;

    /** @type {Set<Function>} */
    const subscribers = new Set();

    // Subscribe function to register a listener
    /**
     * 
     * @param {Function} listener 
     */
    function subscribe(listener) {
        subscribers.add(listener);
        // Return an unsubscribe function
        return () => subscribers.delete(listener);
    }

    function get() {
        return value;
    }

    // Set the store value
    function set(newValue) {
        value = newValue;
        notify();
    }

    // Update the store value using a function
    /**
     * 
     * @param {Function} updater 
     */
    function update(updater) {
        value = updater(value);
        notify();
    }

    // Notify all subscribers of the new value
    function notify() {
        subscribers.forEach((listener) => listener(value));
    }

    return {
        get,
        subscribe,
        set,
        update
    }
}

globalThis.addEventListener('popstate', async (e) => {
    await App.renderPage(new URL(e.state))
})

await App.renderPage(new URL(location.origin))